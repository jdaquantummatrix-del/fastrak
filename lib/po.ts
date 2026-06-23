// Data module for the Purchase Order header + detail (fastrak po.dbf / podet.dbf)
// — orders placed to suppliers. See db/schema/0010_po.sql, 0011_podet.sql and
// issue #9.
//
// A PO has a header (supplier, date, ref) and one or more line items (ordered
// item + qty + unit cost). New rows get a freshly generated 10-char text id,
// matching fastrak's legacy CID keys (ADR-0002). Money (base_cost) is
// numeric(14,2); Postgres returns it as an exact decimal *string* (e.g. "12.50"),
// never a float — so there is no drift (ADR-0001 fidelity).
//
// receivePO posts the order into stock: for each line it records one inventory IN
// movement (refType 'po') so current stock rises by the ordered quantity. It is
// idempotent — an already-received PO is a no-op, so stock is never doubled.
import { type Executor, defaultExecutor, newId, clean } from "./reference";
import { type Db, appDb } from "./db";
import { recordMovement } from "./inventory";

export type POLine = {
  id: string;
  po_id: string | null;
  item_id: string | null;
  description: string | null;
  code: string | null;
  base_cost: string | null; // numeric -> exact decimal string
  qty: number;
  unit: string | null;
  pack_size: number | null;
  unit2: string | null;
  qty2: number | null;
  pcs: number | null;
  // base_cost * qty computed in SQL as numeric(14,2) -> exact decimal string
  // (no JS float drift); null when the line has no base_cost.
  line_total: string | null;
};

export type POHeader = {
  id: string;
  po_no: string | null;
  po_date: string | null; // date -> "YYYY-MM-DD"
  supplier_id: string | null;
  supplier_name: string | null;
  remarks: string | null;
  received: boolean;
};

export type PO = POHeader & { lines: POLine[] };

export type POLineInput = {
  item_id: string;
  qty?: number | null;
  base_cost?: number | string | null;
  description?: string | null;
  code?: string | null;
  unit?: string | null;
  pack_size?: number | null;
  unit2?: string | null;
  qty2?: number | null;
  pcs?: number | null;
};

export type POInput = {
  po_no?: string | null;
  po_date?: string | null;
  supplier_id?: string | null;
  supplier_name?: string | null;
  remarks?: string | null;
  lines?: POLineInput[];
};

// po_date is cast to text so it round-trips as a plain "YYYY-MM-DD" string
// (the shape scripts/dbf.mjs decodes D fields to), not a JS Date with a timezone.
const HEADER_COLUMNS =
  "id, po_no, po_date::text as po_date, supplier_id, supplier_name, remarks, received";

const LINE_COLUMNS =
  "id, po_id, item_id, description, code, base_cost, qty, unit, pack_size, " +
  "unit2, qty2, pcs, (base_cost * qty)::numeric(14,2) as line_total";

// A whole-unit count -> 0 when blank/missing (a line always has a qty).
function count(v: number | null | undefined): number {
  if (v == null) return 0;
  return Math.trunc(v);
}

// An optional whole-unit count -> null when blank (qty2/pack_size/pcs).
function optCount(v: number | null | undefined): number | null {
  if (v == null) return null;
  return Math.trunc(v);
}

// A money value -> null when blank, otherwise the raw value (Postgres parses the
// decimal). Keeping it as-is avoids any binary-float round-trip.
function money(v: number | string | null | undefined): number | string | null {
  if (v == null) return null;
  if (typeof v === "string") {
    const t = v.trim();
    return t === "" ? null : t;
  }
  return v;
}

async function insertLine(
  poId: string,
  line: POLineInput,
  exec: Executor
): Promise<POLine> {
  const id = newId();
  const rows = await exec(
    `insert into podet
       (id, tenant_id, po_id, item_id, description, code, base_cost, qty, unit,
        pack_size, unit2, qty2, pcs)
     values ($1,'fastrak',$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     returning ${LINE_COLUMNS}`,
    [
      id,
      poId,
      clean(line.item_id),
      clean(line.description),
      clean(line.code),
      money(line.base_cost),
      count(line.qty),
      clean(line.unit),
      optCount(line.pack_size),
      clean(line.unit2),
      optCount(line.qty2),
      optCount(line.pcs)
    ]
  );
  return rows[0] as POLine;
}

async function linesFor(poId: string, exec: Executor): Promise<POLine[]> {
  return (await exec(
    `select ${LINE_COLUMNS} from podet where po_id = $1 order by id`,
    [poId]
  )) as POLine[];
}

// Create a PO header and its line items, atomically — the header and every line
// commit together, or none do. Returns the full PO (header + lines).
export async function createPO(input: POInput, db: Db = appDb): Promise<PO> {
  return db.transaction(async (exec) => {
    const id = newId();
    const headerRows = await exec(
      `insert into po
         (id, tenant_id, po_no, po_date, supplier_id, supplier_name, remarks, received)
       values ($1,'fastrak',$2,$3,$4,$5,$6,false)
       returning ${HEADER_COLUMNS}`,
      [
        id,
        clean(input.po_no),
        clean(input.po_date),
        clean(input.supplier_id),
        clean(input.supplier_name),
        clean(input.remarks)
      ]
    );
    const header = headerRows[0] as POHeader;

    const lines: POLine[] = [];
    for (const line of input.lines ?? []) {
      lines.push(await insertLine(id, line, exec));
    }
    return { ...header, lines };
  });
}

// Every PO header, newest-ordered first (no lines — for the list screen).
export async function listPOs(
  exec: Executor = defaultExecutor
): Promise<POHeader[]> {
  return (await exec(
    `select ${HEADER_COLUMNS} from po
      order by po_date desc nulls last, id desc`
  )) as POHeader[];
}

// One PO with its line items, or null when the id is unknown.
export async function getPO(
  id: string,
  exec: Executor = defaultExecutor
): Promise<PO | null> {
  const rows = (await exec(`select ${HEADER_COLUMNS} from po where id = $1`, [
    id
  ])) as POHeader[];
  const header = rows[0];
  if (!header) return null;
  return { ...header, lines: await linesFor(id, exec) };
}

// Receive a PO into stock: for each line, record one inventory IN movement
// (refType 'po') so current stock rises by the ordered quantity, then mark the
// header received. Idempotent — an already-received PO is returned unchanged, so
// the stock is never doubled.
export async function receivePO(id: string, db: Db = appDb): Promise<PO> {
  const existing = await getPO(id, db.query);
  if (!existing) throw new Error(`PO ${id} not found`);
  if (existing.received) return existing;

  // All movements AND the received flip happen in one transaction: if any step
  // fails, nothing commits, so a retry can't double-count stock (the previous
  // attempt left no movements and `received` still false).
  return db.transaction(async (exec) => {
    for (const line of existing.lines) {
      if (!line.item_id) continue; // a line with no item can't move stock
      if (line.qty === 0) continue; // a zero-qty line moves no stock
      await recordMovement(
        {
          itemId: line.item_id,
          in: line.qty,
          refType: "po",
          refId: id,
          refNo: existing.po_no,
          date: existing.po_date,
          name: "Purchase Order"
        },
        exec
      );
    }

    const updated = (await exec(
      `update po set received = true, updated_at = now()
        where id = $1 returning ${HEADER_COLUMNS}`,
      [id]
    )) as POHeader[];
    return { ...(updated[0] as POHeader), lines: existing.lines };
  });
}
