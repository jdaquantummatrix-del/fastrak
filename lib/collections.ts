// Data module for the Collection header + detail (fastrak col.dbf / coldet.dbf) — a
// payment received from a customer, applied against one or more of that customer's
// outstanding A/R entries. See db/schema/0018_col.sql, 0019_coldet.sql and issue #13.
// MONEY-CRITICAL: recording a collection reduces real receivables, so the amounts are
// kept as exact decimal strings end to end (ADR-0001 fidelity).
//
// ── What fastrak does (recovered) ───────────────────────────────────────────────
// A collection is the last step of the receivables flow (… ar -> col/coldet). The
// customer pays; the payment is split across the specific A/R rows it settles, one
// coldet line per A/R row carrying the amount applied to that row. fastrak's A/R
// balance formula subtracts the collected amount (balance = YAMOUNT - (YDBMEMO +
// YCOLLECT)); our `ar` table sums a single `amount` column, so we reproduce the same
// effect by REDUCING the targeted `ar.amount` directly — balanceForCustomer (sum of
// amount) then falls by exactly the payment. A line never reduces a row below zero:
// applying more than is owed clamps to the row's remaining balance (you cannot collect
// more than the row owes), and the coldet line records the amount actually applied.
//
// recordCollection does all of this inside ONE db.transaction: it inserts the col
// header, inserts each coldet line, and reduces each targeted A/R — so a failure
// partway leaves NO partial rows and NO half-reduced receivable.
//
// Money is numeric(14,2); Postgres returns it as an exact decimal *string*, never a
// float. Internally we compare/clamp in integer centavos to avoid binary-float drift,
// then format back to a fixed-2-decimal string.
import { type Executor, defaultExecutor, newId, clean } from "./reference";
import { type Db, appDb } from "./db";

export type CollectionLine = {
  id: string;
  col_id: string | null;
  customer_id: string | null;
  ar_id: string | null;
  dr_no: string | null;
  due_date: string | null; // date -> "YYYY-MM-DD"
  ar_date: string | null; // date -> "YYYY-MM-DD"
  amount: string; // numeric -> exact decimal string (amount applied to this A/R)
};

export type CollectionHeader = {
  id: string;
  col_date: string | null; // date -> "YYYY-MM-DD"
  remarks: string | null;
  customer_id: string | null;
};

// A collection returned to callers: header + lines + the computed `total` (the sum of
// the line amounts = what was collected = what came off the customer's A/R).
export type Collection = CollectionHeader & {
  lines: CollectionLine[];
  total: string;
};

export type CollectionLineInput = {
  ar_id?: string | null;
  amount?: number | string | null;
};

export type CollectionInput = {
  col_date?: string | null;
  customer_id?: string | null;
  remarks?: string | null;
  lines?: CollectionLineInput[];
};

// dates are cast to text so they round-trip as plain "YYYY-MM-DD" strings (the shape
// scripts/dbf.mjs decodes D fields to), not JS Dates with a timezone.
const HEADER_COLUMNS =
  "id, col_date::text as col_date, remarks, customer_id";

const LINE_COLUMNS =
  "id, col_id, customer_id, ar_id, dr_no, due_date::text as due_date, " +
  "ar_date::text as ar_date, amount";

// ── numeric helpers (centavos, to avoid binary-float drift) ──────────────────

// A money value -> integer centavos. Accepts numbers and the decimal strings Postgres
// returns; blank/null -> 0. Rounds half away from zero so 0.005 -> 1 centavo.
function cents(v: number | string | null | undefined): number {
  if (v == null) return 0;
  const n = typeof v === "number" ? v : v.trim() === "" ? 0 : Number(v.trim());
  const sign = n < 0 ? -1 : 1;
  return sign * Math.floor(Math.abs(n) * 100 + 0.5 + 1e-9);
}

// Integer centavos -> a fixed-2-decimal string matching the numeric(14,2) shape.
function fromCents(c: number): string {
  return (c / 100).toFixed(2);
}

// ── persistence ──────────────────────────────────────────────────────────────

// Insert one coldet line and reduce its targeted A/R, INSIDE the caller's transaction.
// The amount actually applied is clamped to the A/R's remaining balance (you cannot
// collect more than the row owes); the line snapshots the A/R's DR no., due date and
// receivable date so the collection prints stably. Returns the persisted line.
async function applyLine(
  colId: string,
  customerId: string | null,
  line: CollectionLineInput,
  exec: Executor
): Promise<CollectionLine> {
  const arId = clean(line.ar_id);
  // Read the targeted receivable (its amount drives the clamp + the snapshots), and
  // LOCK it (`for update`) so two concurrent collections on the same A/R row can't both
  // read the old balance and over-collect it negative — the second blocks until the
  // first commits, then sees the reduced balance.
  const arRows = arId
    ? ((await exec(
        `select amount, customer_id, dr_no, due_date::text as due_date,
                ar_date::text as ar_date
           from ar where id = $1 for update`,
        [arId]
      )) as {
        amount: string;
        customer_id: string | null;
        dr_no: string | null;
        due_date: string | null;
        ar_date: string | null;
      }[])
    : [];
  const ar = arRows[0] ?? null;

  // SECURITY: a collection may only settle ITS OWN customer's receivables. Reject a
  // line whose A/R row belongs to a different customer than the collection header —
  // otherwise a forged ar_id could pay down (or read) another customer's balance.
  if (ar && ar.customer_id !== (customerId ?? null)) {
    throw new Error(
      "Collection line targets a receivable belonging to a different customer"
    );
  }

  // The amount applied: the requested amount, clamped to the row's remaining balance
  // (never more than is owed, never negative). With no targeted A/R, apply 0.
  const owed = ar ? cents(ar.amount) : 0;
  const requested = cents(line.amount);
  const appliedC = Math.max(0, Math.min(requested, owed));
  const applied = fromCents(appliedC);

  // Reduce the receivable by the applied amount (it floors at 0.00 by construction).
  if (ar && appliedC > 0) {
    await exec(
      `update ar set amount = (amount - $2::numeric)::numeric(14,2), updated_at = now()
        where id = $1`,
      [arId, applied]
    );
  }

  const id = newId();
  const rows = await exec(
    `insert into coldet
       (id, tenant_id, col_id, customer_id, ar_id, dr_no, due_date, ar_date, amount)
     values ($1,'fastrak',$2,$3,$4,$5,$6,$7,$8)
     returning ${LINE_COLUMNS}`,
    [
      id,
      colId,
      customerId,
      arId,
      ar?.dr_no ?? null,
      ar?.due_date ?? null,
      ar?.ar_date ?? null,
      applied
    ]
  );
  return rows[0] as CollectionLine;
}

async function linesFor(colId: string, exec: Executor): Promise<CollectionLine[]> {
  return (await exec(
    `select ${LINE_COLUMNS} from coldet where col_id = $1 order by id`,
    [colId]
  )) as CollectionLine[];
}

// The collected total = sum of the line amounts (each an exact decimal string).
function totalOf(lines: CollectionLine[]): string {
  return fromCents(lines.reduce((s, l) => s + cents(l.amount), 0));
}

// Build the full collection (header + lines + computed total) from a header row.
async function hydrate(
  header: CollectionHeader,
  exec: Executor
): Promise<Collection> {
  const lines = await linesFor(header.id, exec);
  return { ...header, lines, total: totalOf(lines) };
}

// Record a collection: insert the col header, apply each payment line against its
// targeted A/R (reducing ar.amount by the amount applied, clamped to what the row
// owes), and snapshot the A/R details on each line — ALL inside one transaction, so a
// failure partway leaves no partial rows and no half-reduced receivable. The header's
// customer_id is threaded onto each line as the per-line CCUSTID (who owes). Returns
// the full collection (header + lines + collected total).
export async function recordCollection(
  input: CollectionInput,
  db: Db = appDb
): Promise<Collection> {
  return db.transaction(async (exec) => {
    const id = newId();
    const customerId = clean(input.customer_id);
    const headerRows = await exec(
      `insert into col (id, tenant_id, col_date, remarks, customer_id)
       values ($1,'fastrak',$2,$3,$4)
       returning ${HEADER_COLUMNS}`,
      [id, clean(input.col_date), clean(input.remarks), customerId]
    );
    const header = headerRows[0] as CollectionHeader;

    const applied: CollectionLine[] = [];
    for (const line of input.lines ?? []) {
      applied.push(await applyLine(id, customerId, line, exec));
    }
    // A collection must move money: reject an empty/zero collection. Throwing here
    // rolls back the header insert (we are inside the transaction), so no empty `col`
    // row is ever left behind.
    const collectedC = applied.reduce((s, l) => s + cents(l.amount), 0);
    if (collectedC <= 0) {
      throw new Error("A collection must apply a positive amount");
    }
    return hydrate(header, exec);
  });
}

// Every collection header, newest first, each carrying its collected total (summed in
// SQL as numeric(14,2) so it is an exact decimal string). No line detail — for the
// list screen.
export async function listCollections(
  exec: Executor = defaultExecutor
): Promise<(CollectionHeader & { total: string })[]> {
  return (await exec(
    `select ${HEADER_COLUMNS},
            coalesce(
              (select sum(amount) from coldet where coldet.col_id = col.id),
              0
            )::numeric(14,2) as total
       from col
      order by col_date desc nulls last, id desc`
  )) as (CollectionHeader & { total: string })[];
}

// One collection with its line items and computed total, or null when id is unknown.
export async function getCollection(
  id: string,
  exec: Executor = defaultExecutor
): Promise<Collection | null> {
  const rows = (await exec(`select ${HEADER_COLUMNS} from col where id = $1`, [
    id
  ])) as CollectionHeader[];
  const header = rows[0];
  if (!header) return null;
  return hydrate(header, exec);
}
