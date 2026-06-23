// Data module for Accounts Receivable (fastrak ar.dbf) — what each customer owes,
// one row per posted Delivery Receipt. See db/schema/0015_ar.sql and issue #11.
//
// ── How an A/R entry comes to exist ─────────────────────────────────────────────
// fastrak does NOT let you create an A/R by hand: getpostar inserts one when a DR is
// POSTED (lib/dr.ts postDR), carrying the DR grand total (computeDRTotals.total) as
// the amount and a due date of (DR date + terms days). Un-posting / cancelling the
// DR removes that A/R row. So this module's WRITE path is `createAR`, called from
// inside postDR's transaction (it takes an Executor, never opens its own
// transaction), and `removeARForDR`, called from cancelDR's transaction. Everything
// else here is read-only reporting: balances and aging per customer.
//
// Money is numeric(14,2); Postgres returns it as an exact decimal *string*, so the
// balance and aging sums never drift (ADR-0001 fidelity). New rows get a freshly
// generated 10-char text id, matching fastrak's legacy CID keys (ADR-0002).
import { type Executor, defaultExecutor, newId, clean } from "./reference";

export type ARRow = {
  id: string;
  customer_id: string | null;
  dr_no: string | null;
  po_no: string | null;
  ar_date: string | null; // date -> "YYYY-MM-DD"
  due_date: string | null; // date -> "YYYY-MM-DD"
  amount: string; // numeric -> exact decimal string
  remarks: string | null;
  dr_id: string | null;
  return_id: string | null;
};

export type ARInput = {
  customer_id?: string | null;
  dr_no?: string | null;
  po_no?: string | null;
  ar_date?: string | null;
  // due date may be supplied directly, OR derived from ar_date + terms_days below.
  due_date?: string | null;
  terms_days?: number | null;
  amount?: number | string | null;
  remarks?: string | null;
  dr_id?: string | null;
  return_id?: string | null;
};

// The aging buckets fastrak ages receivables into, relative to an "as of" date,
// keyed off the due date. `current` = not yet due; the rest are days overdue.
export type Aging = {
  current: string; // due_date >= asOf (or no due date)
  d1_30: string; // 1..30 days overdue
  d31_60: string; // 31..60 days overdue
  d61_90: string; // 61..90 days overdue
  d90_plus: string; // 90+ days overdue
};

// One customer's receivables roll-up: their total outstanding balance plus the
// same amount split into aging buckets. open_count is how many A/R rows back it.
export type CustomerBalance = Aging & {
  customer_id: string | null;
  customer_name: string | null;
  open_count: number;
  balance: string; // total outstanding (= sum of the five buckets)
};

const COLUMNS =
  "id, customer_id, dr_no, po_no, ar_date::text as ar_date, " +
  "due_date::text as due_date, amount, remarks, dr_id, return_id";

// A money value for storage -> "0.00" when blank (amount is NOT NULL). Strings pass
// through untouched so the exact decimal never round-trips through a binary float.
function money(v: number | string | null | undefined): number | string {
  if (v == null) return "0.00";
  if (typeof v === "string") {
    const t = v.trim();
    return t === "" ? "0.00" : t;
  }
  return v;
}

// A whole-day count of payment terms -> null when blank (used to derive due date).
function termsDays(v: number | null | undefined): number | null {
  if (v == null) return null;
  return Math.trunc(v);
}

// ── write path (called from DR posting, inside its transaction) ─────────────────

// Insert one A/R row. Takes an Executor (NOT a Db) so it runs INSIDE the caller's
// transaction — postDR threads its `exec` here so the DR header, its stock OUT
// movements and this receivable all commit (or roll back) as one unit. The due date
// is whatever `due_date` is given, else ar_date + terms_days computed in SQL (so the
// date math matches Postgres, not a JS Date with a timezone), else null.
export async function createAR(
  input: ARInput,
  exec: Executor = defaultExecutor
): Promise<ARRow> {
  const id = newId();
  // Due date = the literal due_date when given, else ar_date + terms days, else null
  // — resolved in SQL (coalesce) off a fixed 1..11 parameter list so the dates stay
  // Postgres dates, not JS Dates with a timezone. ar_date ($4), due_date ($5) and
  // terms ($6) are cast explicitly so a null parameter still has a known type.
  const rows = await exec(
    `insert into ar
       (id, tenant_id, customer_id, ar_date, due_date, dr_no, po_no, amount,
        remarks, dr_id, return_id)
     values (
       $1,'fastrak',$2,$4::date,
       coalesce($5::date, $4::date + $6::int),
       $7,$8,$9,$10,$11,$3
     )
     returning ${COLUMNS}`,
    [
      id,
      clean(input.customer_id),
      clean(input.return_id),
      clean(input.ar_date),
      clean(input.due_date),
      termsDays(input.terms_days),
      clean(input.dr_no),
      clean(input.po_no),
      money(input.amount),
      clean(input.remarks),
      clean(input.dr_id)
    ]
  );
  return rows[0] as ARRow;
}

// Delete the A/R row(s) raised by a given DR. Takes an Executor so cancelDR/unpost
// can remove the receivable INSIDE the same transaction that reverses the stock and
// clears the posted flag. Returns how many rows were removed.
export async function removeARForDR(
  drId: string,
  exec: Executor = defaultExecutor
): Promise<number> {
  const rows = await exec(`delete from ar where dr_id = $1 returning id`, [drId]);
  return rows.length;
}

// Delete the A/R credit row(s) raised by a given Return. A posted return inserts an
// offsetting (negative) A/R row tagged with its return_id (lib/returns.ts postReturn);
// un-posting removes it. Takes an Executor so it runs INSIDE the caller's transaction.
// Returns how many rows were removed.
export async function removeARForReturn(
  returnId: string,
  exec: Executor = defaultExecutor
): Promise<number> {
  const rows = await exec(`delete from ar where return_id = $1 returning id`, [
    returnId
  ]);
  return rows.length;
}

// ── read path (reporting) ───────────────────────────────────────────────────────

// Every A/R row, newest due first (no aggregation — the raw ledger).
export async function listAR(exec: Executor = defaultExecutor): Promise<ARRow[]> {
  return (await exec(
    `select ${COLUMNS} from ar order by due_date desc nulls last, id desc`
  )) as ARRow[];
}

// One A/R row, or null when the id is unknown.
export async function getAR(
  id: string,
  exec: Executor = defaultExecutor
): Promise<ARRow | null> {
  const rows = (await exec(`select ${COLUMNS} from ar where id = $1`, [
    id
  ])) as ARRow[];
  return rows[0] ?? null;
}

// The outstanding balance for one customer = sum of their A/R amounts. Computed in
// SQL as numeric(14,2) so it is an exact decimal string (no float drift). Returns
// "0.00" when the customer has no receivables.
export async function balanceForCustomer(
  customerId: string,
  exec: Executor = defaultExecutor
): Promise<string> {
  const rows = (await exec(
    `select coalesce(sum(amount), 0)::numeric(14,2) as balance
       from ar where customer_id = $1`,
    [customerId]
  )) as { balance: string }[];
  return String(rows[0]?.balance ?? "0.00");
}

// Receivables rolled up per customer: total balance plus an aging breakdown keyed
// off each row's due date relative to `asOf` (default today). A row with no due date
// counts as `current` (not overdue). All five buckets and the balance are summed in
// SQL as numeric(14,2), so they are exact decimal strings that add up to `balance`.
export async function summarizeByCustomer(
  exec: Executor = defaultExecutor,
  asOf?: string
): Promise<CustomerBalance[]> {
  const rows = (await exec(
    `select
        ar.customer_id,
        c.name as customer_name,
        count(*)::int as open_count,
        coalesce(sum(ar.amount), 0)::numeric(14,2) as balance,
        coalesce(sum(ar.amount) filter (
          where ar.due_date is null or ar.due_date >= $1::date
        ), 0)::numeric(14,2) as current,
        coalesce(sum(ar.amount) filter (
          where $1::date - ar.due_date between 1 and 30
        ), 0)::numeric(14,2) as d1_30,
        coalesce(sum(ar.amount) filter (
          where $1::date - ar.due_date between 31 and 60
        ), 0)::numeric(14,2) as d31_60,
        coalesce(sum(ar.amount) filter (
          where $1::date - ar.due_date between 61 and 90
        ), 0)::numeric(14,2) as d61_90,
        coalesce(sum(ar.amount) filter (
          where $1::date - ar.due_date > 90
        ), 0)::numeric(14,2) as d90_plus
       from ar
       left join customers c on c.id = ar.customer_id
      group by ar.customer_id, c.name
      order by balance desc, c.name nulls last, ar.customer_id`,
    [asOf ?? new Date().toISOString().slice(0, 10)]
  )) as CustomerBalance[];
  return rows;
}
