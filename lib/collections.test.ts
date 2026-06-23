import path from "node:path";
import { fileURLToPath } from "node:url";
import { test, expect } from "vitest";
import { createTestDb, asDb } from "./test-db";
import {
  recordCollection,
  listCollections,
  getCollection,
  type CollectionLineInput
} from "./collections";
import { createCustomer } from "./customers";
import { createItem } from "./items";
import { createDR, postDR } from "./dr";
import { listAR, getAR, balanceForCustomer } from "./ar";
import { readDbf } from "../scripts/dbf.mjs";

// A PGlite-backed executor matching the lib/db.ts `query` shape — for reads and the
// read-only helpers. Transactional functions (recordCollection) take a Db built from
// the same PGlite via asDb.
function executor(db: Awaited<ReturnType<typeof createTestDb>>) {
  return (text: string, params?: unknown[]) =>
    db.query(text, params).then((r) => r.rows as Record<string, unknown>[]);
}

const here = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(here, "..", "incoming", "fastrak", "fastrak", "DATA");

// Raise one receivable for a customer by posting a one-line DR; returns the A/R row.
async function raiseAR(
  db: Awaited<ReturnType<typeof createTestDb>>,
  customerId: string,
  drNo: string,
  amount: string // the per-piece price of a single unit -> the A/R amount
) {
  const q = executor(db);
  const d = asDb(db);
  const item = await createItem({ code: `IT-${drNo}` }, q);
  await import("./inventory").then((m) => m.recordMovement({ itemId: item.id, in: 1000 }, q));
  const dr = await createDR(
    {
      dr_no: drNo,
      dr_date: "2024-01-01",
      customer_id: customerId,
      terms_days: 30,
      lines: [{ item_id: item.id, qty: 1, qty2: 1, price: amount }]
    },
    d
  );
  await postDR(dr.id, d);
  const ars = await listAR(q);
  return ars.find((a) => a.dr_id === dr.id)!;
}

// ---------------------------------------------------------------------------
// THE KEY INTEGRATION — recording a collection reduces the customer's A/R by the
// paid amount (acceptance criterion: "A/R balances reduced correctly").
// ---------------------------------------------------------------------------

test("recordCollection reduces the customer's A/R balance by the paid amount", async () => {
  const db = await createTestDb();
  const q = executor(db);
  const d = asDb(db);
  const cust = await createCustomer({ name: "Payer", terms_days: 30 }, q);

  // Two outstanding receivables: 300.00 and 200.00 -> balance 500.00.
  const ar1 = await raiseAR(db, cust.id, "DR-1", "300.00");
  const ar2 = await raiseAR(db, cust.id, "DR-2", "200.00");
  expect(await balanceForCustomer(cust.id, q)).toBe("500.00");

  // Pay 300.00 fully against ar1 and 50.00 partially against ar2 -> total 350.00.
  const col = await recordCollection(
    {
      col_date: "2024-02-15",
      customer_id: cust.id,
      remarks: "check #123",
      lines: [
        { ar_id: ar1.id, amount: "300.00" },
        { ar_id: ar2.id, amount: "50.00" }
      ]
    },
    d
  );

  expect(col.id).toHaveLength(10);
  expect(col.lines).toHaveLength(2);
  expect(col.total).toBe("350.00"); // sum of the line amounts (exact decimal string)

  // The balance fell by exactly the collected amount: 500.00 - 350.00 = 150.00.
  expect(await balanceForCustomer(cust.id, q)).toBe("150.00");
  // ar1 is fully paid (0.00), ar2 reduced to 150.00.
  expect((await getAR(ar1.id, q))?.amount).toBe("0.00");
  expect((await getAR(ar2.id, q))?.amount).toBe("150.00");
  await db.close();
});

test("recordCollection snapshots the A/R's DR no., due date and amount on each line", async () => {
  const db = await createTestDb();
  const q = executor(db);
  const d = asDb(db);
  const cust = await createCustomer({ name: "Snap", terms_days: 30 }, q);
  const ar1 = await raiseAR(db, cust.id, "DR-9", "120.00");

  const col = await recordCollection(
    {
      col_date: "2024-03-01",
      customer_id: cust.id,
      lines: [{ ar_id: ar1.id, amount: "120.00" }]
    },
    d
  );

  const line = col.lines[0]!;
  expect(line.ar_id).toBe(ar1.id);
  expect(line.customer_id).toBe(cust.id);
  expect(line.dr_no).toBe("DR-9");
  expect(line.due_date).toBe(ar1.due_date);
  expect(line.ar_date).toBe(ar1.ar_date);
  expect(line.amount).toBe("120.00");
  await db.close();
});

test("recordCollection generates a unique 10-char id and tags tenant fastrak", async () => {
  const db = await createTestDb();
  const q = executor(db);
  const d = asDb(db);
  const cust = await createCustomer({ name: "Tenant" }, q);
  const ar1 = await raiseAR(db, cust.id, "DR-T", "10.00");

  const a = await recordCollection(
    { customer_id: cust.id, lines: [{ ar_id: ar1.id, amount: "5.00" }] },
    d
  );
  const b = await recordCollection({ customer_id: cust.id, lines: [] }, d);
  expect(a.id).not.toBe(b.id);
  expect(a.id).toHaveLength(10);

  const hdr = await q("select tenant_id from col where id = $1", [a.id]);
  expect(hdr[0]?.tenant_id).toBe("fastrak");
  const lines = await q("select tenant_id from coldet where col_id = $1", [a.id]);
  expect(lines[0]?.tenant_id).toBe("fastrak");
  await db.close();
});

test("a collection never reduces an A/R below zero (overpaying a row clamps the applied amount)", async () => {
  const db = await createTestDb();
  const q = executor(db);
  const d = asDb(db);
  const cust = await createCustomer({ name: "Over", terms_days: 0 }, q);
  const ar1 = await raiseAR(db, cust.id, "DR-O", "100.00");

  // Apply 150 against a 100 receivable: the A/R floors at 0.00 and the line records
  // only the 100.00 actually applied (you cannot collect more than is owed on a row).
  const col = await recordCollection(
    { customer_id: cust.id, lines: [{ ar_id: ar1.id, amount: "150.00" }] },
    d
  );
  expect((await getAR(ar1.id, q))?.amount).toBe("0.00");
  expect(col.lines[0]?.amount).toBe("100.00");
  expect(col.total).toBe("100.00");
  expect(await balanceForCustomer(cust.id, q)).toBe("0.00");
  await db.close();
});

// ---------------------------------------------------------------------------
// CRUD / reads
// ---------------------------------------------------------------------------

test("listCollections returns headers (no lines); getCollection returns lines", async () => {
  const db = await createTestDb();
  const q = executor(db);
  const d = asDb(db);
  const cust = await createCustomer({ name: "List" }, q);
  const ar1 = await raiseAR(db, cust.id, "DR-L", "40.00");

  const created = await recordCollection(
    { col_date: "2024-04-04", customer_id: cust.id, lines: [{ ar_id: ar1.id, amount: "40.00" }] },
    d
  );

  const list = await listCollections(q);
  expect(list).toHaveLength(1);
  expect(list[0]?.id).toBe(created.id);
  expect(list[0]?.total).toBe("40.00"); // total surfaced on the list row

  const fetched = await getCollection(created.id, q);
  expect(fetched?.lines).toHaveLength(1);
  expect(fetched?.lines[0]?.amount).toBe("40.00");
  await db.close();
});

test("getCollection returns null for an unknown id", async () => {
  const db = await createTestDb();
  const q = executor(db);
  expect(await getCollection("NOPE000000", q)).toBeNull();
  await db.close();
});

// ---------------------------------------------------------------------------
// Atomicity / rollback — recordCollection inserts the col header + every coldet line
// AND reduces every targeted A/R as ONE unit. Forcing a failure partway must leave NO
// partial rows (no header, no lines) and NO A/R reduced.
// ---------------------------------------------------------------------------

// A Db that runs a real PGlite transaction but throws when a matching statement is
// attempted inside it — used to break recordCollection partway and prove the rollback.
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
          return tx
            .query(text, params)
            .then((r) => r.rows as Record<string, unknown>[]);
        };
        return fn(exec);
      })
  };
}

test("recordCollection rolls back the header, the lines AND the A/R reduction on a mid-way failure", async () => {
  const db = await createTestDb();
  const q = executor(db);
  const d = asDb(db);
  const cust = await createCustomer({ name: "Rollback", terms_days: 30 }, q);
  const ar1 = await raiseAR(db, cust.id, "DR-RB1", "300.00");
  const ar2 = await raiseAR(db, cust.id, "DR-RB2", "200.00");
  expect(await balanceForCustomer(cust.id, q)).toBe("500.00");

  const lines: CollectionLineInput[] = [
    { ar_id: ar1.id, amount: "300.00" },
    { ar_id: ar2.id, amount: "50.00" }
  ];

  // Break the A/R reduction (the `update ar set amount …`): by then the header and at
  // least one line have been written inside the transaction. The throw must roll ALL
  // of it back — no col, no coldet, no A/R touched.
  const poison = failingOn(db, /update ar set/i);
  await expect(
    recordCollection({ customer_id: cust.id, lines }, poison)
  ).rejects.toThrow();

  expect(await balanceForCustomer(cust.id, q)).toBe("500.00"); // untouched
  expect((await getAR(ar1.id, q))?.amount).toBe("300.00");
  expect((await getAR(ar2.id, q))?.amount).toBe("200.00");
  const cols = await q("select count(*)::int as n from col");
  expect((cols[0] as { n: number }).n).toBe(0);
  const dets = await q("select count(*)::int as n from coldet");
  expect((dets[0] as { n: number }).n).toBe(0);

  // A healthy retry records exactly once.
  const col = await recordCollection({ customer_id: cust.id, lines }, d);
  expect(col.total).toBe("350.00");
  expect(await balanceForCustomer(cust.id, q)).toBe("150.00");
  await db.close();
});

// ---------------------------------------------------------------------------
// FIDELITY — load fastrak's ACTUAL col/coldet sample rows and prove our collected
// total reproduces the document (the Y-currency amounts decode exactly).
// ---------------------------------------------------------------------------

type ColRow = { CID: string; DDATE: string; CCUSTID2: string };
type ColDetRow = {
  CCOLID: string;
  CARID: string;
  CCUSTID: string;
  CDRNO: string;
  YAMOUNT: number | null;
};

function loadFastrak() {
  const col = readDbf(path.join(DATA, "col.dbf")).records as unknown as ColRow[];
  const det = readDbf(path.join(DATA, "coldet.dbf")).records as unknown as ColDetRow[];
  return { col, det };
}

test("fidelity: the fastrak sample collection totals exactly", () => {
  const { col, det } = loadFastrak();
  expect(col.length).toBeGreaterThan(0);
  // Collection CID 313: a single coldet line of YAMOUNT 19260 -> 19260.00 collected.
  const c = col[0]!;
  const lines = det.filter((d) => d.CCOLID.trim() === c.CID.trim());
  const total = lines
    .reduce((s, l) => s + (l.YAMOUNT == null ? 0 : Number(l.YAMOUNT)), 0)
    .toFixed(2);
  expect(total).toBe("19260.00");
  expect(lines[0]?.CDRNO).toBe("1983");
});
