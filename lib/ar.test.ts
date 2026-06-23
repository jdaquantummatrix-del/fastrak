import path from "node:path";
import { fileURLToPath } from "node:url";
import { test, expect } from "vitest";
import { createTestDb, asDb } from "./test-db";
import {
  createAR,
  removeARForDR,
  listAR,
  getAR,
  balanceForCustomer,
  summarizeByCustomer
} from "./ar";
import { createDR, postDR, cancelDR } from "./dr";
import { createCustomer } from "./customers";
import { createItem } from "./items";
import { readDbf } from "../scripts/dbf.mjs";

// A PGlite-backed executor matching the lib/db.ts `query` shape — for reads and the
// read-only helpers. Transactional functions (postDR/cancelDR) take a Db built from
// the same PGlite via asDb.
function executor(db: Awaited<ReturnType<typeof createTestDb>>) {
  return (text: string, params?: unknown[]) =>
    db.query(text, params).then((r) => r.rows as Record<string, unknown>[]);
}

// ---------------------------------------------------------------------------
// THE KEY INTEGRATION — posting a DR raises the receivable; cancelling removes it.
// ---------------------------------------------------------------------------

test("posting a DR creates an A/R of the DR grand total, due = DR date + terms", async () => {
  const db = await createTestDb();
  const q = executor(db);
  const d = asDb(db);
  const cust = await createCustomer({ name: "Acme Buyer", terms_days: 30 }, q);
  const item = await createItem({ code: "WIDGET" }, q);

  // net = round(20*240*0.95,2)=4560 ; add 5% = 228 ; doc disc 3% = 136.80
  // grand total = (4560 + 228) - 136.80 = 4651.20  (matches lib/dr.test.ts)
  const dr = await createDR(
    {
      dr_no: "DR-001",
      dr_date: "2024-02-01",
      customer_id: cust.id,
      terms_days: 30,
      po_no: "CUST-PO-9",
      doc_disc: 3,
      add_pct: 5,
      remarks: "rush",
      lines: [{ item_id: item.id, qty: 5, qty2: 240, price: "20.00", disc: 5 }]
    },
    d
  );
  expect(dr.total).toBe("4651.20");

  // Before posting there is no receivable.
  expect(await listAR(q)).toHaveLength(0);

  await postDR(dr.id, d);

  const ars = await listAR(q);
  expect(ars).toHaveLength(1);
  const ar = ars[0]!;
  expect(ar.amount).toBe("4651.20"); // the DR grand total, exact decimal string
  expect(ar.customer_id).toBe(cust.id);
  expect(ar.dr_id).toBe(dr.id);
  expect(ar.dr_no).toBe("DR-001");
  expect(ar.po_no).toBe("CUST-PO-9");
  expect(ar.ar_date).toBe("2024-02-01");
  expect(ar.due_date).toBe("2024-03-02"); // 2024-02-01 + 30 days
  expect(ar.remarks).toBe("rush");
});

test("cancelling a posted DR removes its A/R row", async () => {
  const db = await createTestDb();
  const q = executor(db);
  const d = asDb(db);
  const cust = await createCustomer({ name: "Beta Buyer", terms_days: 0 }, q);
  const item = await createItem({ code: "GADGET" }, q);

  const dr = await createDR(
    {
      dr_no: "DR-CANCEL",
      dr_date: "2024-04-10",
      customer_id: cust.id,
      terms_days: 0,
      lines: [{ item_id: item.id, qty: 1, qty2: 10, price: "5.00" }]
    },
    d
  );
  await postDR(dr.id, d);
  expect(await listAR(q)).toHaveLength(1);

  await cancelDR(dr.id, d);
  expect(await listAR(q)).toHaveLength(0);
  expect(await balanceForCustomer(cust.id, q)).toBe("0.00");
});

test("posting is idempotent — re-posting does not raise a second A/R", async () => {
  const db = await createTestDb();
  const q = executor(db);
  const d = asDb(db);
  const cust = await createCustomer({ name: "Idem", terms_days: 30 }, q);
  const item = await createItem({ code: "I" }, q);

  const dr = await createDR(
    {
      dr_no: "IDEM",
      dr_date: "2024-01-01",
      customer_id: cust.id,
      terms_days: 30,
      lines: [{ item_id: item.id, qty: 1, qty2: 4, price: "2.00" }]
    },
    d
  );
  await postDR(dr.id, d);
  await postDR(dr.id, d);
  expect(await listAR(q)).toHaveLength(1);
});

// ---------------------------------------------------------------------------
// balanceForCustomer + aging
// ---------------------------------------------------------------------------

test("balanceForCustomer sums all of a customer's receivables", async () => {
  const db = await createTestDb();
  const q = executor(db);
  const d = asDb(db);
  const a = await createCustomer({ name: "Customer A", terms_days: 30 }, q);
  const b = await createCustomer({ name: "Customer B", terms_days: 30 }, q);
  const item = await createItem({ code: "P" }, q);

  // Two posted DRs for A, one for B — balances must not bleed across customers.
  const mk = async (no: string, cust: string, qty2: number, price: string) =>
    postDR(
      (
        await createDR(
          {
            dr_no: no,
            dr_date: "2024-01-01",
            customer_id: cust,
            terms_days: 30,
            lines: [{ item_id: item.id, qty: 1, qty2, price }]
          },
          d
        )
      ).id,
      d
    );

  await mk("A1", a.id, 100, "10.00"); // 1000.00
  await mk("A2", a.id, 50, "4.00"); // 200.00
  await mk("B1", b.id, 7, "3.00"); // 21.00

  expect(await balanceForCustomer(a.id, q)).toBe("1200.00");
  expect(await balanceForCustomer(b.id, q)).toBe("21.00");
});

test("balanceForCustomer is 0.00 for a customer with no receivables", async () => {
  const db = await createTestDb();
  const q = executor(db);
  const c = await createCustomer({ name: "Empty" }, q);
  expect(await balanceForCustomer(c.id, q)).toBe("0.00");
});

test("summarizeByCustomer ages each receivable by its due date relative to asOf", async () => {
  const db = await createTestDb();
  const q = executor(db);
  const cust = await createCustomer({ name: "Aged", terms_days: 0 }, q);

  // asOf = 2024-06-30. Place receivables in each bucket by choosing due dates.
  await createAR({ customer_id: cust.id, amount: "100.00", due_date: "2024-07-31" }, q); // future -> current
  await createAR({ customer_id: cust.id, amount: "10.00", due_date: "2024-06-15" }, q); // 15 overdue -> 1-30
  await createAR({ customer_id: cust.id, amount: "20.00", due_date: "2024-05-20" }, q); // 41 overdue -> 31-60
  await createAR({ customer_id: cust.id, amount: "30.00", due_date: "2024-04-20" }, q); // 71 overdue -> 61-90
  await createAR({ customer_id: cust.id, amount: "40.00", due_date: "2024-01-01" }, q); // 181 overdue -> 90+

  const [row] = await summarizeByCustomer(q, "2024-06-30");
  expect(row?.customer_id).toBe(cust.id);
  expect(row?.customer_name).toBe("Aged");
  expect(row?.open_count).toBe(5);
  expect(row?.balance).toBe("200.00");
  expect(row?.current).toBe("100.00");
  expect(row?.d1_30).toBe("10.00");
  expect(row?.d31_60).toBe("20.00");
  expect(row?.d61_90).toBe("30.00");
  expect(row?.d90_plus).toBe("40.00");
  // the buckets partition the balance exactly
  const buckets = [
    row!.current,
    row!.d1_30,
    row!.d31_60,
    row!.d61_90,
    row!.d90_plus
  ];
  const sum = buckets.map(Number).reduce((x, y) => x + y, 0);
  expect(sum.toFixed(2)).toBe(row?.balance);
});

// ---------------------------------------------------------------------------
// CRUD-level behaviour of the A/R module itself
// ---------------------------------------------------------------------------

test("createAR generates a 10-char id, tags tenant, getAR round-trips", async () => {
  const db = await createTestDb();
  const q = executor(db);
  const cust = await createCustomer({ name: "C" }, q);
  const ar = await createAR(
    { customer_id: cust.id, amount: "123.45", ar_date: "2024-02-01", terms_days: 60 },
    q
  );
  expect(ar.id).toHaveLength(10);
  expect(ar.amount).toBe("123.45");
  expect(ar.due_date).toBe("2024-04-01"); // +60 days
  const fetched = await getAR(ar.id, q);
  expect(fetched?.id).toBe(ar.id);
  const tenant = await q("select tenant_id from ar where id = $1", [ar.id]);
  expect(tenant[0]?.tenant_id).toBe("fastrak");
  expect(await getAR("NOPE000000", q)).toBeNull();
});

test("removeARForDR deletes only the rows linked to that DR", async () => {
  const db = await createTestDb();
  const q = executor(db);
  const d = asDb(db);
  const cust = await createCustomer({ name: "C", terms_days: 30 }, q);
  const item = await createItem({ code: "RM" }, q);

  // dr_id is a real FK to dr(id), so link the receivables to real (posted) DRs.
  const drA = await createDR(
    {
      dr_no: "A",
      dr_date: "2024-01-01",
      customer_id: cust.id,
      terms_days: 30,
      lines: [{ item_id: item.id, qty: 1, qty2: 1, price: "10.00" }]
    },
    d
  );
  const drB = await createDR(
    {
      dr_no: "B",
      dr_date: "2024-01-01",
      customer_id: cust.id,
      terms_days: 30,
      lines: [{ item_id: item.id, qty: 1, qty2: 1, price: "30.00" }]
    },
    d
  );
  await postDR(drA.id, d); // raises a 10.00 receivable on drA
  await postDR(drB.id, d); // raises a 30.00 receivable on drB
  // a second receivable on drA, to prove ALL of a DR's rows go
  await createAR({ customer_id: cust.id, amount: "20.00", dr_id: drA.id }, q);

  const removed = await removeARForDR(drA.id, q);
  expect(removed).toBe(2);
  expect(await balanceForCustomer(cust.id, q)).toBe("30.00"); // only drB's remains
});

// ---------------------------------------------------------------------------
// Atomicity / rollback — posting writes inventory + A/R + the flag as ONE unit.
// Forcing a failure after the A/R insert must leave NO partial rows (no A/R, no
// movements, posted still false).
// ---------------------------------------------------------------------------

// A Db that runs a real PGlite transaction but throws when the Nth matching insert
// is attempted inside it — used to break postDR partway and prove the rollback.
function failingOn(
  db: Awaited<ReturnType<typeof createTestDb>>,
  pattern: RegExp
): import("./db").Db {
  return {
    query: (text, params) =>
      db.query(text, params).then((r) => r.rows as Record<string, unknown>[]),
    transaction: (fn) =>
      db.transaction(async (tx) => {
        const exec = (text: string, params?: unknown[]) => {
          if (pattern.test(text)) {
            throw new Error("injected failure mid-transaction");
          }
          return tx.query(text, params).then((r) => r.rows as Record<string, unknown>[]);
        };
        return fn(exec);
      })
  };
}

test("postDR rolls back the A/R when posting fails after it is inserted", async () => {
  const db = await createTestDb();
  const q = executor(db);
  const d = asDb(db);
  const cust = await createCustomer({ name: "Rollback", terms_days: 30 }, q);
  const item = await createItem({ code: "RB" }, q);
  const { recordMovement } = await import("./inventory");
  await recordMovement({ itemId: item.id, in: 100 }, q);

  const dr = await createDR(
    {
      dr_no: "RB",
      dr_date: "2024-02-01",
      customer_id: cust.id,
      terms_days: 30,
      lines: [{ item_id: item.id, qty: 1, qty2: 10, price: "5.00" }]
    },
    d
  );

  // Break the final "update dr set posted = true" — by then the OUT movement and the
  // A/R row have both been written inside the transaction. The throw must roll BOTH
  // back: no A/R, no movement from the post, posted still false.
  const poison = failingOn(db, /update dr set posted/i);
  await expect(postDR(dr.id, poison)).rejects.toThrow();

  expect(await listAR(q)).toHaveLength(0);
  expect(await balanceForCustomer(cust.id, q)).toBe("0.00");
  const moves = await q("select count(*)::int as n from inventory where dr_id = $1", [dr.id]);
  expect((moves[0] as { n: number }).n).toBe(0);
  const reread = await q("select posted from dr where id = $1", [dr.id]);
  expect(reread[0]?.posted).toBe(false);

  // A healthy retry then posts exactly one A/R.
  await postDR(dr.id, d);
  expect(await listAR(q)).toHaveLength(1);
  expect(await balanceForCustomer(cust.id, q)).toBe("50.00");
});

// ---------------------------------------------------------------------------
// FIDELITY — load a sample of fastrak-family A/R rows (ar.dbf has the exact 10-field
// CID/CCUSTID/CDRNO/CPONO/DDATE/DDUE/YAMOUNT/CREMARKS/CDRID/CRETID structure from
// incoming/fastrak-schema.txt) and prove our createAR reproduces, EXACTLY:
//   • the stored due date  (DDUE == ar_date + terms days)
//   • the stored amount    (YAMOUNT, as an exact decimal string — no float drift)
//   • the per-customer + total balance (sum of YAMOUNTs)
// The fastrak DATA/ar.dbf the repo ships is empty, so the sample is drawn from the
// champion ar.dbf, which carries the identical structure and real DDATE/DDUE/YAMOUNT
// data (same CodeBook A/R table).
// ---------------------------------------------------------------------------

const here = path.dirname(fileURLToPath(import.meta.url));
const AR_DBF = path.join(
  here,
  "..",
  "incoming",
  "champion",
  "champion",
  "DATA",
  "ar.dbf"
);

type ArRow = {
  CID: string;
  CCUSTID: string;
  CDRNO: string;
  CPONO: string;
  DDATE: string | null;
  DDUE: string | null;
  YAMOUNT: number | null;
  CREMARKS: string;
  CDRID: string;
  CRETID?: string;
};

const dayDiff = (a: string, b: string) =>
  Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

// The fastrak ar.dbf sample: the first 8 rows that carry a date, due date and amount.
function sampleAR(): ArRow[] {
  const rows = readDbf(AR_DBF).records as unknown as ArRow[];
  return rows.filter((r) => r.DDATE && r.DDUE && r.YAMOUNT != null).slice(0, 8);
}

test("fidelity: createAR reproduces each sample row's due date and amount exactly", async () => {
  const db = await createTestDb();
  const q = executor(db);
  const sample = sampleAR();
  expect(sample).toHaveLength(8);

  for (const r of sample) {
    const terms = dayDiff(r.DDATE!, r.DDUE!); // fastrak: DDUE = DDATE + NTERMS
    const amount = Number(r.YAMOUNT).toFixed(2); // Y currency -> exact decimal string
    // dr_id is left null here: the sample's CDRID points at champion DRs we don't
    // migrate (and it is a real FK). The fidelity being proven is the due-date and
    // amount math, not the document link.
    const ar = await createAR(
      {
        dr_no: r.CDRNO.trim() || null,
        po_no: r.CPONO.trim() || null,
        ar_date: r.DDATE,
        terms_days: terms,
        amount
      },
      q
    );
    // due date derived as ar_date + terms equals fastrak's stored DDUE
    expect(ar.due_date, `${r.CID.trim()} due`).toBe(r.DDUE);
    // amount round-trips as the exact stored value
    expect(ar.amount, `${r.CID.trim()} amount`).toBe(amount);
  }
});

test("fidelity: per-customer and total balances match the sum of the sample's YAMOUNTs", async () => {
  const db = await createTestDb();
  const q = executor(db);
  const sample = sampleAR();

  // Materialise a customer per distinct CCUSTID so the FK + per-customer balance hold.
  const seen = new Map<string, string>();
  const expectedByCust = new Map<string, number>();
  let expectedTotal = 0;
  for (const r of sample) {
    const key = r.CCUSTID.trim();
    if (!seen.has(key)) {
      const c = await createCustomer({ name: `cust ${key}` }, q);
      seen.set(key, c.id);
    }
    const amt = Number(r.YAMOUNT);
    expectedTotal += amt;
    expectedByCust.set(key, (expectedByCust.get(key) ?? 0) + amt);
    await createAR(
      { customer_id: seen.get(key)!, ar_date: r.DDATE, due_date: r.DDUE, amount: amt.toFixed(2) },
      q
    );
  }

  // Each customer's balance equals the sum of that customer's sampled YAMOUNTs.
  for (const [key, custId] of seen) {
    expect(await balanceForCustomer(custId, q)).toBe(expectedByCust.get(key)!.toFixed(2));
  }

  // The total across the summary equals the sum of all sampled YAMOUNTs.
  const summary = await summarizeByCustomer(q, "2019-12-31");
  const total = summary.reduce((s, row) => s + Number(row.balance), 0);
  expect(total.toFixed(2)).toBe(expectedTotal.toFixed(2));
});
