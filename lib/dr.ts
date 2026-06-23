// Data module for the Delivery Receipt header + detail (fastrak dr.dbf / drdet.dbf)
// — a sale/delivery to a customer. See db/schema/0012_dr.sql, 0013_drdet.sql and
// issue #10. HUMAN-IN-THE-LOOP / money-critical: the totals and discount math below
// were RECOVERED from fastrak's FoxPro source (LIBS/abizness.vct) and validated
// against the real sample data (see the fidelity tests in lib/dr.test.ts).
//
// ── What fastrak does (recovered from abizness.vct) ─────────────────────────────
// A DR line carries NQTY (qty in the primary unit, e.g. boxes) and NQTY2 (that
// quantity expanded to *pieces* = NQTY * NPACK). All of fastrak's money math and
// inventory posting operate on NQTY2 (pieces), NOT NQTY.
//
//   per-line amount  = round( (yprice * nqty2) * ((100-ndisc)/100)
//                                                * ((100-ndisc2)/100), 2 )   [getdiscount]
//   gross            = sum( yprice * nqty2 )                                  [getsumvalue]
//   net              = sum( per-line amount )      (each line rounded, then summed)
//   add_amount (YADD)= round( net * (NADD/100), 2 )                           [Refresh ptextbox12]
//   doc_disc_amount  = round( net * (NDRDISC/100), 2 )                        [Refresh ptextbox7]
//   GRAND TOTAL      = (net + add_amount) - doc_disc_amount                   [Refresh ptextbox9]
//
// NDRDISC2 (a second document-level discount %) is stored by fastrak but NOT used
// in the grand-total Refresh formula, so we preserve it but do not apply it.
// On POST (getpostar) fastrak inserts the GRAND TOTAL as the A/R amount and sets
// LPOST; on the same post (getpost) it writes one inventory OUT per item of
// sum(nqty2). A/R is a later slice, so postDR here only writes the inventory OUT
// movements and flips the posted flag. cancelDR reverses those movements.
//
// Money is numeric(14,2); Postgres returns it as an exact decimal *string*, never a
// float, so there is no drift (ADR-0001 fidelity). Internally we compute in integer
// centavos with FoxPro's round-half-away-from-zero, then format back to a string.
import { type Executor, defaultExecutor, newId, clean } from "./reference";
import { type Db, appDb } from "./db";
import { recordMovement } from "./inventory";

export type DRLine = {
  id: string;
  dr_id: string | null;
  item_id: string | null;
  description: string | null;
  code: string | null;
  price: string | null; // numeric -> exact decimal string
  base_cost: string | null;
  qty: number;
  unit: string | null;
  disc: string | null;
  disc2: string | null;
  pack_size: string | null;
  qty2: number;
  unit2: string | null;
  seq: string | null;
};

export type DRHeader = {
  id: string;
  dr_no: string | null;
  customer_id: string | null;
  address: string | null;
  dr_date: string | null; // date -> "YYYY-MM-DD"
  remarks: string | null;
  terms_days: number;
  po_no: string | null;
  doc_disc: string | null;
  doc_disc2: string | null;
  add_pct: string | null;
  add_amount: string | null;
  type: string | null;
  dr_si: string | null;
  posted: boolean;
  cancelled: boolean;
  received: boolean | null;
};

// A DR returned to callers: header + lines + the computed currency totals
// (gross / net / add_amount / doc_disc_amount / total). `total` is the grand total
// fastrak posts to A/R.
export type DRTotals = {
  gross: string;
  net: string;
  add_amount: string;
  doc_disc_amount: string;
  total: string;
};

export type DR = DRHeader & { lines: DRLine[] } & DRTotals;

export type DRLineInput = {
  item_id?: string | null;
  qty?: number | null;
  qty2?: number | null;
  price?: number | string | null;
  base_cost?: number | string | null;
  disc?: number | string | null;
  disc2?: number | string | null;
  description?: string | null;
  code?: string | null;
  unit?: string | null;
  unit2?: string | null;
  pack_size?: number | string | null;
  seq?: number | string | null;
};

export type DRInput = {
  dr_no?: string | null;
  dr_date?: string | null;
  customer_id?: string | null;
  address?: string | null;
  remarks?: string | null;
  terms_days?: number | null;
  po_no?: string | null;
  doc_disc?: number | string | null;
  doc_disc2?: number | string | null;
  add_pct?: number | string | null;
  type?: string | null;
  dr_si?: string | null;
  lines?: DRLineInput[];
};

// dr_date is cast to text so it round-trips as a plain "YYYY-MM-DD" string (the
// shape scripts/dbf.mjs decodes D fields to), not a JS Date with a timezone.
const HEADER_COLUMNS =
  "id, dr_no, customer_id, address, dr_date::text as dr_date, remarks, " +
  "terms_days, po_no, doc_disc, doc_disc2, add_pct, add_amount, type, dr_si, " +
  "posted, cancelled, received";

const LINE_COLUMNS =
  "id, dr_id, item_id, description, code, price, base_cost, qty, unit, disc, " +
  "disc2, pack_size, qty2, unit2, seq";

// ── numeric helpers ─────────────────────────────────────────────────────────

// A whole-unit count -> 0 when blank/missing (qty/qty2 always have a value).
function count(v: number | null | undefined): number {
  if (v == null) return 0;
  return Math.trunc(v);
}

// A money/percentage value -> a Number for arithmetic. Accepts numbers and the
// decimal strings Postgres returns; blank/null -> 0.
function num(v: number | string | null | undefined): number {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  const t = v.trim();
  return t === "" ? 0 : Number(t);
}

// A money value for storage -> null when blank, otherwise the raw value (Postgres
// parses the decimal). Keeping it as-is avoids any binary-float round-trip.
function money(v: number | string | null | undefined): number | string | null {
  if (v == null) return null;
  if (typeof v === "string") {
    const t = v.trim();
    return t === "" ? null : t;
  }
  return v;
}

// A percentage value for storage -> 0 when blank (the columns are NOT NULL).
function pct(v: number | string | null | undefined): number | string {
  if (v == null) return 0;
  if (typeof v === "string") {
    const t = v.trim();
    return t === "" ? 0 : t;
  }
  return v;
}

// FoxPro ROUND(x, 2): round half AWAY from zero to 2 decimals. We work in integer
// centavos to avoid the binary-float artifacts plain Math.round would introduce.
function round2(x: number): number {
  const cents = x * 100;
  const sign = cents < 0 ? -1 : 1;
  // nudge to absorb representation error (e.g. 0.005*100 = 0.4999999…)
  const rounded = Math.floor(Math.abs(cents) + 0.5 + 1e-9);
  return (sign * rounded) / 100;
}

// Format a Number as a fixed-2-decimal string matching the numeric(14,2) shape
// Postgres returns (so computed totals compare equal to stored values).
function fixed2(x: number): string {
  // round once more defensively, then toFixed
  return round2(x).toFixed(2);
}

// ── the calculation (the load-bearing money math) ───────────────────────────

// Compute the DR currency totals exactly the way fastrak's DR form does. `header`
// carries the document discount % (NDRDISC) and add-on % (NADD); `lines` carry the
// per-piece price, piece quantity (qty2) and the two line discount %s. Returns the
// five currency figures as exact 2-decimal strings.
export function computeDRTotals(
  header: { doc_disc?: number | string | null; add_pct?: number | string | null },
  lines: DRLineInput[]
): DRTotals {
  let gross = 0;
  let net = 0;
  for (const l of lines) {
    const price = num(l.price);
    const qty2 = count(l.qty2);
    const d1 = num(l.disc);
    const d2 = num(l.disc2);
    gross += price * qty2;
    // per line: round( (price*qty2) * ((100-d1)/100) * ((100-d2)/100), 2 )
    net += round2(price * qty2 * ((100 - d1) / 100) * ((100 - d2) / 100));
  }
  const addPct = num(header.add_pct);
  const docDisc = num(header.doc_disc);
  const add_amount = round2(net * (addPct / 100));
  const doc_disc_amount = round2(net * (docDisc / 100));
  const total = net + add_amount - doc_disc_amount;
  return {
    gross: fixed2(gross),
    net: fixed2(net),
    add_amount: fixed2(add_amount),
    doc_disc_amount: fixed2(doc_disc_amount),
    total: fixed2(total)
  };
}

// ── persistence ─────────────────────────────────────────────────────────────

async function insertLine(
  drId: string,
  line: DRLineInput,
  exec: Executor
): Promise<DRLine> {
  const id = newId();
  const rows = await exec(
    `insert into drdet
       (id, tenant_id, dr_id, item_id, description, code, price, base_cost, qty,
        unit, disc, disc2, pack_size, qty2, unit2, seq)
     values ($1,'fastrak',$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
     returning ${LINE_COLUMNS}`,
    [
      id,
      drId,
      clean(line.item_id),
      clean(line.description),
      clean(line.code),
      money(line.price),
      money(line.base_cost),
      count(line.qty),
      clean(line.unit),
      pct(line.disc),
      pct(line.disc2),
      money(line.pack_size),
      count(line.qty2),
      clean(line.unit2),
      money(line.seq)
    ]
  );
  return rows[0] as DRLine;
}

async function linesFor(drId: string, exec: Executor): Promise<DRLine[]> {
  return (await exec(
    `select ${LINE_COLUMNS} from drdet where dr_id = $1 order by seq nulls last, id`,
    [drId]
  )) as DRLine[];
}

// Build the full DR (header + lines + computed totals) from a header row.
async function hydrate(header: DRHeader, exec: Executor): Promise<DR> {
  const lines = await linesFor(header.id, exec);
  const totals = computeDRTotals(
    { doc_disc: header.doc_disc, add_pct: header.add_pct },
    lines.map((l) => ({
      qty2: l.qty2,
      price: l.price,
      disc: l.disc,
      disc2: l.disc2
    }))
  );
  return { ...header, lines, ...totals };
}

// Create a DR header and its line items. The add-on currency (YADD) is computed and
// stored on the header so it matches fastrak's stored value; the other totals are
// derived on read. Returns the full DR (header + lines + totals).
export async function createDR(input: DRInput, db: Db = appDb): Promise<DR> {
  return db.transaction(async (exec) => {
    const id = newId();
    const lineInputs = input.lines ?? [];
    const { add_amount } = computeDRTotals(input, lineInputs);

    const headerRows = await exec(
      `insert into dr
         (id, tenant_id, dr_no, customer_id, address, dr_date, remarks, terms_days,
          po_no, doc_disc, doc_disc2, add_pct, add_amount, type, dr_si,
          posted, cancelled)
       values ($1,'fastrak',$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,false,false)
       returning ${HEADER_COLUMNS}`,
      [
        id,
        clean(input.dr_no),
        clean(input.customer_id),
        clean(input.address),
        clean(input.dr_date),
        clean(input.remarks),
        count(input.terms_days),
        clean(input.po_no),
        pct(input.doc_disc),
        pct(input.doc_disc2),
        pct(input.add_pct),
        add_amount,
        clean(input.type),
        clean(input.dr_si)
      ]
    );
    const header = headerRows[0] as DRHeader;

    for (const line of lineInputs) {
      await insertLine(id, line, exec);
    }
    return hydrate(header, exec);
  });
}

// Replace a DR's header fields and its line items (lines are deleted + reinserted,
// matching the form's "edit then save" semantics). Recomputes and stores YADD.
// Refuses to edit a posted DR (its stock and totals are committed).
export async function updateDR(
  id: string,
  input: DRInput,
  db: Db = appDb
): Promise<DR> {
  return db.transaction(async (exec) => {
    const existing = (await exec(`select posted from dr where id = $1`, [id])) as {
      posted: boolean;
    }[];
    if (existing.length === 0) throw new Error(`DR ${id} not found`);
    if (existing[0]?.posted) throw new Error(`DR ${id} is posted and cannot be edited`);

    const lineInputs = input.lines ?? [];
    const { add_amount } = computeDRTotals(input, lineInputs);

    const headerRows = await exec(
      `update dr set
         dr_no = $2, customer_id = $3, address = $4, dr_date = $5, remarks = $6,
         terms_days = $7, po_no = $8, doc_disc = $9, doc_disc2 = $10, add_pct = $11,
         add_amount = $12, type = $13, dr_si = $14, updated_at = now()
       where id = $1
       returning ${HEADER_COLUMNS}`,
      [
        id,
        clean(input.dr_no),
        clean(input.customer_id),
        clean(input.address),
        clean(input.dr_date),
        clean(input.remarks),
        count(input.terms_days),
        clean(input.po_no),
        pct(input.doc_disc),
        pct(input.doc_disc2),
        pct(input.add_pct),
        add_amount,
        clean(input.type),
        clean(input.dr_si)
      ]
    );
    const header = headerRows[0] as DRHeader;

    await exec(`delete from drdet where dr_id = $1`, [id]);
    for (const line of lineInputs) {
      await insertLine(id, line, exec);
    }
    return hydrate(header, exec);
  });
}

// Every DR header, newest first (no lines/totals — for the list screen).
export async function listDRs(
  exec: Executor = defaultExecutor
): Promise<DRHeader[]> {
  return (await exec(
    `select ${HEADER_COLUMNS} from dr
      order by dr_date desc nulls last, id desc`
  )) as DRHeader[];
}

// One DR with its line items and computed totals, or null when the id is unknown.
export async function getDR(
  id: string,
  exec: Executor = defaultExecutor
): Promise<DR | null> {
  const rows = (await exec(`select ${HEADER_COLUMNS} from dr where id = $1`, [
    id
  ])) as DRHeader[];
  const header = rows[0];
  if (!header) return null;
  return hydrate(header, exec);
}

// Post a DR: release stock by recording one inventory OUT movement per line of
// qty2 (pieces) — matching fastrak's getpost (sum(nqty2) per item) — then mark the
// header posted. Idempotent: an already-posted DR is returned unchanged so stock is
// never double-released. Refuses a cancelled DR. (A/R is a later slice; the grand
// total fastrak would post to A/R is available as the returned DR's `total`.)
export async function postDR(id: string, db: Db = appDb): Promise<DR> {
  const existing = await getDR(id, db.query);
  if (!existing) throw new Error(`DR ${id} not found`);
  if (existing.cancelled) throw new Error(`DR ${id} is cancelled and cannot be posted`);
  if (existing.posted) return existing;

  // The OUT movements and the posted flip are one transaction: a failure midway
  // commits nothing, so a retry can't double-release stock.
  return db.transaction(async (exec) => {
    for (const line of existing.lines) {
      if (!line.item_id) continue; // a line with no item can't move stock
      if (line.qty2 === 0) continue;
      await recordMovement(
        {
          itemId: line.item_id,
          out: line.qty2,
          refType: "dr",
          refId: id,
          refNo: existing.dr_no,
          date: existing.dr_date,
          name: "Delivery Receipt"
        },
        exec
      );
    }

    const updated = (await exec(
      `update dr set posted = true, updated_at = now()
        where id = $1 returning ${HEADER_COLUMNS}`,
      [id]
    )) as DRHeader[];
    return hydrate(updated[0] as DRHeader, exec);
  });
}

// Cancel (void) a DR. If it was posted, reverse its stock by recording an
// offsetting inventory IN movement per line of qty2 (pieces), then clear the posted
// flag and set cancelled. An unposted DR is simply marked cancelled (no movements).
// Idempotent: an already-cancelled DR is returned unchanged.
export async function cancelDR(id: string, db: Db = appDb): Promise<DR> {
  const existing = await getDR(id, db.query);
  if (!existing) throw new Error(`DR ${id} not found`);
  if (existing.cancelled) return existing;

  // The reversing movements and the flag changes are one transaction: a failure
  // midway commits nothing, so a retry can't double-reverse stock.
  return db.transaction(async (exec) => {
    if (existing.posted) {
      for (const line of existing.lines) {
        if (!line.item_id) continue;
        if (line.qty2 === 0) continue;
        await recordMovement(
          {
            itemId: line.item_id,
            in: line.qty2, // offsetting IN reverses the OUT
            refType: "dr",
            refId: id,
            refNo: existing.dr_no,
            date: existing.dr_date,
            name: "Delivery Receipt (cancelled)"
          },
          exec
        );
      }
    }

    const updated = (await exec(
      `update dr set cancelled = true, posted = false, updated_at = now()
        where id = $1 returning ${HEADER_COLUMNS}`,
      [id]
    )) as DRHeader[];
    return hydrate(updated[0] as DRHeader, exec);
  });
}
