// Data module for the Return header + detail (fastrak return.dbf / returndet.dbf) —
// goods a customer sends back. See db/schema/0016_return.sql, 0017_returndet.sql and
// issue #12. MONEY-CRITICAL: the line value math below mirrors fastrak's DR line
// discount math (recovered from LIBS/abizness.vct), and posting was recovered from
// the return form's getpost/unpost.
//
// ── What fastrak does on POST (return form getpost, recovered) ───────────────────
// Posting a return does TWO things, both reproduced by postReturn inside ONE
// transaction (so a failure partway leaves no partial rows):
//   1. STOCK BACK IN — for each returndet line flagged LGOOD (resalable only —
//      damaged/non-good lines are NOT restocked), it appends an inventory IN of NQTY
//      (refType 'return'). A return line moves stock by NQTY directly (it has no
//      NQTY2/NPACK; the quantity is already in the line's unit).
//   2. A/R DOWN — the return reduces what the customer owes. fastrak posts a debit
//      memo (debitdet, type 'D') against the linked A/R row and its balance formula
//      subtracts it: balance = YAMOUNT - (YDBMEMO + YCOLLECT). Our `ar` table sums a
//      single `amount` column, so we model the same effect as an OFFSETTING NEGATIVE
//      A/R row (return_id set, amount = -return value): balanceForCustomer (sum of
//      amount) falls by exactly the return value. Un-posting removes that row.
//
// Money is numeric(14,2); Postgres returns it as an exact decimal *string*, never a
// float, so there is no drift (ADR-0001 fidelity). Internally we compute the value in
// integer centavos with FoxPro's round-half-away-from-zero, then format back.
import { type Executor, defaultExecutor, newId, clean } from "./reference";
import { type Db, appDb } from "./db";
import { recordMovement } from "./inventory";
import { createAR, removeARForReturn } from "./ar";

export type ReturnLine = {
  id: string;
  return_id: string | null;
  item_id: string | null;
  qty: number;
  unit: string | null;
  price: string | null; // numeric -> exact decimal string
  base_cost: string | null;
  description: string | null;
  code: string | null;
  disc: string | null;
  disc2: string | null;
  good: boolean | null;
};

export type ReturnHeader = {
  id: string;
  customer_id: string | null;
  return_date: string | null; // date -> "YYYY-MM-DD"
  remarks: string | null;
  ret_customer: string | null;
  ret_ar: string | null;
  bo_no: string | null;
  applied: boolean | null;
  dr_id: string | null;
  type: string | null;
  posted: boolean;
};

// A return returned to callers: header + lines + the computed `value` (the total
// credit the return is worth — what comes off the customer's A/R on post).
export type Return = ReturnHeader & { lines: ReturnLine[]; value: string };

export type ReturnLineInput = {
  item_id?: string | null;
  qty?: number | null;
  price?: number | string | null;
  base_cost?: number | string | null;
  disc?: number | string | null;
  disc2?: number | string | null;
  description?: string | null;
  code?: string | null;
  unit?: string | null;
  good?: boolean | null;
};

export type ReturnInput = {
  return_date?: string | null;
  customer_id?: string | null;
  remarks?: string | null;
  ret_customer?: string | null;
  ret_ar?: string | null;
  bo_no?: string | null;
  dr_id?: string | null;
  type?: string | null;
  lines?: ReturnLineInput[];
};

// return_date is cast to text so it round-trips as a plain "YYYY-MM-DD" string (the
// shape scripts/dbf.mjs decodes D fields to), not a JS Date with a timezone.
const HEADER_COLUMNS =
  "id, customer_id, return_date::text as return_date, remarks, ret_customer, " +
  "ret_ar, bo_no, applied, dr_id, type, posted";

const LINE_COLUMNS =
  "id, return_id, item_id, qty, unit, price, base_cost, description, code, " +
  "disc, disc2, good";

// ── numeric helpers (same shape as lib/dr.ts) ────────────────────────────────

// A whole-unit count -> 0 when blank/missing (a line always has a qty).
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
  const rounded = Math.floor(Math.abs(cents) + 0.5 + 1e-9);
  return (sign * rounded) / 100;
}

// Format a Number as a fixed-2-decimal string matching the numeric(14,2) shape.
function fixed2(x: number): string {
  return round2(x).toFixed(2);
}

// ── the calculation (the return's total value / credit) ──────────────────────

// The total value of a return = sum of per-line amounts, each line valued exactly
// the way a DR line's net is: round( price * qty * ((100-disc)/100) * ((100-disc2)/100), 2 )
// then summed (each line rounded first, matching fastrak getdiscount). Returns the
// figure as an exact 2-decimal string. This is the amount that comes off the
// customer's A/R when the return is posted.
export function computeReturnValue(lines: ReturnLineInput[]): string {
  let value = 0;
  for (const l of lines) {
    const price = num(l.price);
    const qty = count(l.qty);
    const d1 = num(l.disc);
    const d2 = num(l.disc2);
    value += round2(price * qty * ((100 - d1) / 100) * ((100 - d2) / 100));
  }
  return fixed2(value);
}

// ── persistence ──────────────────────────────────────────────────────────────

// A logical flag for storage -> true/false when given, null when blank (LGOOD is
// nullable; only a true value restocks on post — null/false leave goods out of stock).
function bool(v: boolean | null | undefined): boolean | null {
  if (v == null) return null;
  return v;
}

async function insertLine(
  returnId: string,
  line: ReturnLineInput,
  exec: Executor
): Promise<ReturnLine> {
  const id = newId();
  const rows = await exec(
    `insert into returndet
       (id, tenant_id, return_id, item_id, qty, unit, price, base_cost,
        description, code, disc, disc2, good)
     values ($1,'fastrak',$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     returning ${LINE_COLUMNS}`,
    [
      id,
      returnId,
      clean(line.item_id),
      count(line.qty),
      clean(line.unit),
      money(line.price),
      money(line.base_cost),
      clean(line.description),
      clean(line.code),
      pct(line.disc),
      pct(line.disc2),
      bool(line.good)
    ]
  );
  return rows[0] as ReturnLine;
}

async function linesFor(returnId: string, exec: Executor): Promise<ReturnLine[]> {
  return (await exec(
    `select ${LINE_COLUMNS} from returndet where return_id = $1 order by id`,
    [returnId]
  )) as ReturnLine[];
}

// Build the full return (header + lines + computed value) from a header row.
async function hydrate(header: ReturnHeader, exec: Executor): Promise<Return> {
  const lines = await linesFor(header.id, exec);
  const value = computeReturnValue(
    lines.map((l) => ({ qty: l.qty, price: l.price, disc: l.disc, disc2: l.disc2 }))
  );
  return { ...header, lines, value };
}

// Create a return header and its line items, atomically — the header and every line
// commit together, or none do. Returns the full return (header + lines + value).
export async function createReturn(
  input: ReturnInput,
  db: Db = appDb
): Promise<Return> {
  return db.transaction(async (exec) => {
    const id = newId();
    const headerRows = await exec(
      `insert into return
         (id, tenant_id, customer_id, return_date, remarks, ret_customer, ret_ar,
          bo_no, dr_id, type, posted)
       values ($1,'fastrak',$2,$3,$4,$5,$6,$7,$8,$9,false)
       returning ${HEADER_COLUMNS}`,
      [
        id,
        clean(input.customer_id),
        clean(input.return_date),
        clean(input.remarks),
        clean(input.ret_customer),
        clean(input.ret_ar),
        clean(input.bo_no),
        clean(input.dr_id),
        clean(input.type)
      ]
    );
    const header = headerRows[0] as ReturnHeader;

    for (const line of input.lines ?? []) {
      await insertLine(id, line, exec);
    }
    return hydrate(header, exec);
  });
}

// Every return header, newest first (no lines/value — for the list screen).
export async function listReturns(
  exec: Executor = defaultExecutor
): Promise<ReturnHeader[]> {
  return (await exec(
    `select ${HEADER_COLUMNS} from return
      order by return_date desc nulls last, id desc`
  )) as ReturnHeader[];
}

// One return with its line items and computed value, or null when the id is unknown.
export async function getReturn(
  id: string,
  exec: Executor = defaultExecutor
): Promise<Return | null> {
  const rows = (await exec(`select ${HEADER_COLUMNS} from return where id = $1`, [
    id
  ])) as ReturnHeader[];
  const header = rows[0];
  if (!header) return null;
  return hydrate(header, exec);
}

// Post a return: put resalable goods back into stock and credit the customer's A/R.
// For each LGOOD line, record one inventory IN movement of qty (refType 'return') —
// matching fastrak's getpost (only LGOOD lines append to inventory). Then raise an
// OFFSETTING NEGATIVE A/R row of the return value (return_id set), so the customer's
// balance falls by exactly that amount. Finally mark the header posted. Idempotent:
// an already-posted return is returned unchanged so stock is never double-raised and
// no duplicate credit is written.
export async function postReturn(id: string, db: Db = appDb): Promise<Return> {
  const existing = await getReturn(id, db.query);
  if (!existing) throw new Error(`Return ${id} not found`);
  if (existing.posted) return existing;

  // The IN movements, the A/R credit and the posted flip are one transaction: a
  // failure midway commits nothing, so a retry can't double-restock or write a
  // duplicate credit (the previous attempt left no movements, posted still false).
  return db.transaction(async (exec) => {
    for (const line of existing.lines) {
      if (line.good !== true) continue; // only resalable goods go back into stock
      if (!line.item_id) continue; // a line with no item can't move stock
      if (line.qty === 0) continue; // a zero-qty line moves no stock
      await recordMovement(
        {
          itemId: line.item_id,
          in: line.qty,
          refType: "return",
          refId: id,
          refNo: existing.id,
          date: existing.return_date,
          name: "Return"
        },
        exec
      );
    }

    // Credit the customer's A/R: an offsetting NEGATIVE row of the return value, due
    // on the return date, tagged with this return so un-posting can remove it.
    const value = Number(existing.value);
    if (value !== 0) {
      await createAR(
        {
          customer_id: existing.customer_id,
          return_id: id,
          ar_date: existing.return_date,
          due_date: existing.return_date,
          amount: (-value).toFixed(2),
          remarks: existing.remarks
        },
        exec
      );
    }

    const updated = (await exec(
      `update return set posted = true, updated_at = now()
        where id = $1 returning ${HEADER_COLUMNS}`,
      [id]
    )) as ReturnHeader[];
    return hydrate(updated[0] as ReturnHeader, exec);
  });
}

// Un-post (reverse) a posted return: remove its restock movements and its A/R credit,
// then clear the posted flag — matching fastrak's unpost (delete from inventory/
// debitdet where cretid = …, set lpost = .F.). All in one transaction. Idempotent:
// an unposted return is returned unchanged.
export async function unpostReturn(id: string, db: Db = appDb): Promise<Return> {
  const existing = await getReturn(id, db.query);
  if (!existing) throw new Error(`Return ${id} not found`);
  if (!existing.posted) return existing;

  return db.transaction(async (exec) => {
    // Remove the restock movements this return wrote.
    await exec(`delete from inventory where return_id = $1`, [id]);
    // Remove the A/R credit it raised (no-op if there is none).
    await removeARForReturn(id, exec);

    const updated = (await exec(
      `update return set posted = false, updated_at = now()
        where id = $1 returning ${HEADER_COLUMNS}`,
      [id]
    )) as ReturnHeader[];
    return hydrate(updated[0] as ReturnHeader, exec);
  });
}
