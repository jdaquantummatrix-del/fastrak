import { test, expect } from "vitest";
import { createTestDb, asDb } from "./test-db";
import { loadDemoData, wipeDemoData, isDemoLoaded } from "./demo";
import { listItems } from "./items";
import { listCustomers } from "./customers";
import { listPOs } from "./po";
import { listDRs, drStatus } from "./dr";
import { listReturns } from "./returns";
import { listCollections } from "./collections";
import { listAR, summarizeByCustomer, totalOutstanding } from "./ar";
import { stockByItem } from "./inventory";

// A PGlite-backed read executor matching the lib/db.ts `query` shape.
function executor(db: Awaited<ReturnType<typeof createTestDb>>) {
  return (text: string, params?: unknown[]) =>
    db.query(text, params).then((r) => r.rows as Record<string, unknown>[]);
}

test("loadDemoData builds a coherent PO -> DR -> A/R -> Collection scenario", async () => {
  const db = await createTestDb();
  const q = executor(db);
  const d = asDb(db);

  const summary = await loadDemoData(d);

  // Reference data + catalog: ~10-12 items, ~7 customers across types.
  const items = await listItems(q);
  expect(items.length).toBeGreaterThanOrEqual(10);
  expect(items.length).toBeLessThanOrEqual(12);

  const customers = await listCustomers(q);
  expect(customers.length).toBeGreaterThanOrEqual(7);
  // customers span more than one type.
  const types = new Set(customers.map((c) => c.type).filter(Boolean));
  expect(types.size).toBeGreaterThanOrEqual(2);

  // 2-3 POs, all received into stock (so inventory shows meaningful data).
  const pos = await listPOs(q);
  expect(pos.length).toBeGreaterThanOrEqual(2);
  expect(pos.length).toBeLessThanOrEqual(3);
  expect(pos.every((p) => p.received)).toBe(true);

  const stock = await stockByItem(q);
  expect(stock.length).toBeGreaterThan(0);
  // received POs put positive stock on the shelf for at least some items.
  expect(stock.some((s) => s.stock > 0)).toBe(true);

  // 4-5 DRs, several posted, at least one left as a draft.
  const drs = await listDRs(q);
  expect(drs.length).toBeGreaterThanOrEqual(4);
  expect(drs.length).toBeLessThanOrEqual(5);
  const posted = drs.filter((dr) => drStatus(dr) === "posted");
  const drafts = drs.filter((dr) => drStatus(dr) === "draft");
  expect(posted.length).toBeGreaterThanOrEqual(2);
  expect(drafts.length).toBeGreaterThanOrEqual(1);

  // Posted DRs raise A/R, so balances exist and aging has something to show.
  const ar = await listAR(q);
  expect(ar.length).toBeGreaterThan(0);
  expect(Number(await totalOutstanding(q))).toBeGreaterThan(0);

  // A 1-2 collections reduced some balances; at least one customer shows aging.
  const collections = await listCollections(q);
  expect(collections.length).toBeGreaterThanOrEqual(1);
  expect(collections.length).toBeLessThanOrEqual(2);

  // asOf far in the future so the demo's older posted DRs land in overdue buckets.
  const balances = await summarizeByCustomer(q, "2099-01-01");
  const withBalance = balances.filter((b) => Number(b.balance) > 0);
  expect(withBalance.length).toBeGreaterThan(0);
  const anyOverdue = balances.some((b) => Number(b.d90_plus) > 0);
  expect(anyOverdue).toBe(true);

  // A return exists.
  const returns = await listReturns(q);
  expect(returns.length).toBeGreaterThanOrEqual(1);

  // The summary reports what it built.
  expect(summary.items).toBe(items.length);
  expect(summary.customers).toBe(customers.length);
  expect(summary.purchaseOrders).toBe(pos.length);
  expect(summary.deliveryReceipts).toBe(drs.length);
});

test("isDemoLoaded reflects whether demo data is present", async () => {
  const db = await createTestDb();
  const d = asDb(db);
  expect(await isDemoLoaded(d.query)).toBe(false);
  await loadDemoData(d);
  expect(await isDemoLoaded(d.query)).toBe(true);
});

test("wipeDemoData removes every row the loader created and nothing else", async () => {
  const db = await createTestDb();
  const q = executor(db);
  const d = asDb(db);

  // A REAL (non-demo) customer that the wipe must never touch.
  const realId = "REALCUST00";
  await q(
    `insert into customers (id, tenant_id, name, type) values ($1,'fastrak',$2,$3)`,
    [realId, "Real Co (keep me)", "Wholesale"]
  );

  await loadDemoData(d);
  // Demo rows are present across the document tables.
  expect((await listDRs(q)).length).toBeGreaterThan(0);
  expect((await listAR(q)).length).toBeGreaterThan(0);

  await wipeDemoData(d);

  // Every demo-created document/reference row is gone.
  expect(await isDemoLoaded(d.query)).toBe(false);
  expect((await listPOs(q)).length).toBe(0);
  expect((await listDRs(q)).length).toBe(0);
  expect((await listReturns(q)).length).toBe(0);
  expect((await listCollections(q)).length).toBe(0);
  expect((await listAR(q)).length).toBe(0);
  expect((await stockByItem(q)).length).toBe(0);
  expect((await listItems(q)).length).toBe(0);

  // The real customer survives.
  const survivors = await listCustomers(q);
  expect(survivors.map((c) => c.id)).toContain(realId);
  expect(survivors.every((c) => c.id === realId)).toBe(true);

  // The registry is empty.
  const reg = (await q(`select count(*)::int as n from demo_data`)) as { n: number }[];
  expect(reg[0]?.n).toBe(0);
});

test("loadDemoData is idempotent — a second load does not double the data", async () => {
  const db = await createTestDb();
  const q = executor(db);
  const d = asDb(db);

  await loadDemoData(d);
  const itemsAfterFirst = (await listItems(q)).length;
  const drsAfterFirst = (await listDRs(q)).length;

  await loadDemoData(d);
  expect((await listItems(q)).length).toBe(itemsAfterFirst);
  expect((await listDRs(q)).length).toBe(drsAfterFirst);
});
