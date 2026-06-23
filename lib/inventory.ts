// Data module for the Inventory ledger (fastrak inventory.dbf) — the stock
// movement log. See db/schema/0009_inventory.sql and issue #8.
//
// Each row is one movement of an item: qty_in units received, qty_out units
// released, referencing the source document (PO / DR / discrepancy / return).
// Current stock per item = sum(qty_in) - sum(qty_out). Quantities are whole
// integers, so balances are exact (no float drift). New rows get a freshly
// generated 10-char text id, matching fastrak's legacy CID keys (ADR-0002).
import { type Executor, defaultExecutor, newId, clean } from "./reference";

// The source-document kinds a movement can reference. Each maps to its own id
// column so the ledger stays joinable to the parent document later.
export type RefType = "po" | "dr" | "dscrp" | "return";

const REF_COLUMN: Record<RefType, "po_id" | "dr_id" | "dscrp_id" | "return_id"> = {
  po: "po_id",
  dr: "dr_id",
  dscrp: "dscrp_id",
  return: "return_id"
};

export type Movement = {
  id: string;
  item_id: string | null;
  cost_price_id: string | null;
  ref_no: string | null;
  movement_date: string | null; // date -> "YYYY-MM-DD"
  qty_in: number;
  qty_out: number;
  name: string | null;
  po_id: string | null;
  dr_id: string | null;
  dscrp_id: string | null;
  return_id: string | null;
};

export type MovementInput = {
  itemId: string;
  in?: number | null;
  out?: number | null;
  refType?: RefType | null;
  refId?: string | null;
  refNo?: string | null;
  name?: string | null;
  date?: string | null;
};

// One stock balance per item, joined to the item's catalog fields.
export type ItemStock = {
  item_id: string;
  code: string | null;
  description: string | null;
  unit: string | null;
  critical: number | null;
  stock: number;
};

// movement_date is cast to text so it round-trips as a plain "YYYY-MM-DD" string
// (the shape scripts/dbf.mjs decodes D fields to), not a JS Date with a timezone.
const COLUMNS =
  "id, item_id, cost_price_id, ref_no, movement_date::text as movement_date, " +
  "qty_in, qty_out, name, po_id, dr_id, dscrp_id, return_id";

// A whole-unit count -> 0 when blank/missing (the ledger never stores null qty).
function count(v: number | null | undefined): number {
  if (v == null) return 0;
  return Math.trunc(v);
}

// Validate the in/out quantities before a movement is written. A movement must
// be EITHER an in OR an out — never negative, never both, never empty — because
// currentStock = sum(in) - sum(out): a negative qty, or one row carrying both,
// silently corrupts the balance. (NB: in/out are truncated to whole units first,
// so a fractional 0.4 reads as 0 and is rejected as empty.)
function validateQuantities(qtyIn: number, qtyOut: number): void {
  if (qtyIn < 0 || qtyOut < 0) {
    throw new Error("movement quantities cannot be negative");
  }
  if (qtyIn > 0 && qtyOut > 0) {
    throw new Error("a movement must be either an in or an out, not both");
  }
  if (qtyIn === 0 && qtyOut === 0) {
    throw new Error("a movement must have a non-zero in or out quantity");
  }
}

// Record one stock movement. `refType` + `refId` route the source-document id to
// the matching column (po_id / dr_id / dscrp_id / return_id).
export async function recordMovement(
  input: MovementInput,
  exec: Executor = defaultExecutor
): Promise<Movement> {
  const qtyIn = count(input.in);
  const qtyOut = count(input.out);
  validateQuantities(qtyIn, qtyOut);

  const id = newId();
  const refIds: Record<string, string | null> = {
    po_id: null,
    dr_id: null,
    dscrp_id: null,
    return_id: null
  };
  const refId = clean(input.refId);
  if (input.refType && refId) {
    refIds[REF_COLUMN[input.refType]] = refId;
  }

  const rows = await exec(
    `insert into inventory
       (id, tenant_id, item_id, ref_no, movement_date, qty_in, qty_out, name,
        po_id, dr_id, dscrp_id, return_id)
     values ($1,'fastrak',$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     returning ${COLUMNS}`,
    [
      id,
      input.itemId,
      clean(input.refNo),
      clean(input.date),
      qtyIn,
      qtyOut,
      clean(input.name),
      refIds.po_id,
      refIds.dr_id,
      refIds.dscrp_id,
      refIds.return_id
    ]
  );
  return rows[0] as Movement;
}

// Current stock for one item = sum(qty_in) - sum(qty_out). Returns 0 when the
// item has no movements.
export async function currentStock(
  itemId: string,
  exec: Executor = defaultExecutor
): Promise<number> {
  const rows = await exec(
    `select coalesce(sum(qty_in) - sum(qty_out), 0) as stock
       from inventory where item_id = $1`,
    [itemId]
  );
  return Number((rows[0] as { stock: number | string }).stock);
}

// One current-stock row per item that has movements, joined to its catalog
// fields, ordered by item code. The current-stock-per-item view.
export async function stockByItem(
  exec: Executor = defaultExecutor
): Promise<ItemStock[]> {
  const rows = (await exec(
    `select inv.item_id,
            it.code, it.description, it.unit, it.critical,
            sum(inv.qty_in) - sum(inv.qty_out) as stock
       from inventory inv
       join items it on it.id = inv.item_id
      group by inv.item_id, it.code, it.description, it.unit, it.critical
      order by it.code nulls last, inv.item_id`
  )) as Array<Omit<ItemStock, "stock"> & { stock: number | string }>;
  return rows.map((r) => ({ ...r, stock: Number(r.stock) }));
}

// Movement history, newest first. Pass an itemId to filter to a single item.
export async function listMovements(
  exec: Executor = defaultExecutor,
  itemId?: string
): Promise<Movement[]> {
  if (itemId) {
    return (await exec(
      `select ${COLUMNS} from inventory where item_id = $1
        order by movement_date desc nulls last, id desc`,
      [itemId]
    )) as Movement[];
  }
  return (await exec(
    `select ${COLUMNS} from inventory
      order by movement_date desc nulls last, id desc`
  )) as Movement[];
}
