import { test, expect } from "vitest";
import { createTestDb } from "./test-db";
import {
  recordMovement,
  currentStock,
  listMovements,
  stockByItem
} from "./inventory";
import { createItem } from "./items";

// A PGlite-backed executor matching the lib/db.ts `query` shape.
function executor(db: Awaited<ReturnType<typeof createTestDb>>) {
  return (text: string, params?: unknown[]) =>
    db.query(text, params).then((r) => r.rows as Record<string, unknown>[]);
}

test("recordMovement then listMovements returns the new row", async () => {
  const db = await createTestDb();
  const q = executor(db);
  const item = await createItem({ code: "SKU-1" }, q);

  const mv = await recordMovement(
    {
      itemId: item.id,
      in: 100,
      refType: "po",
      refId: "PO00000001",
      refNo: "PO-123",
      date: "2024-01-15"
    },
    q
  );
  expect(mv.item_id).toBe(item.id);
  expect(mv.qty_in).toBe(100);
  expect(mv.qty_out).toBe(0);
  expect(mv.po_id).toBe("PO00000001");
  expect(mv.movement_date).toBe("2024-01-15");

  const moves = await listMovements(q);
  expect(moves).toHaveLength(1);
  expect(moves[0]?.id).toBe(mv.id);
  await db.close();
});

test("currentStock = sum of ins minus sum of outs", async () => {
  const db = await createTestDb();
  const q = executor(db);
  const item = await createItem({ code: "WIDGET" }, q);

  await recordMovement({ itemId: item.id, in: 100, refType: "po" }, q); // +100
  await recordMovement({ itemId: item.id, in: 50, refType: "po" }, q); //  +50
  await recordMovement({ itemId: item.id, out: 30, refType: "dr" }, q); //  -30
  await recordMovement({ itemId: item.id, out: 20, refType: "dr" }, q); //  -20

  // 100 + 50 - 30 - 20 = 100
  expect(await currentStock(item.id, q)).toBe(100);
  await db.close();
});

test("currentStock is zero for an item with no movements", async () => {
  const db = await createTestDb();
  const q = executor(db);
  const item = await createItem({ code: "EMPTY" }, q);
  expect(await currentStock(item.id, q)).toBe(0);
  await db.close();
});

test("currentStock can go negative when outs exceed ins", async () => {
  const db = await createTestDb();
  const q = executor(db);
  const item = await createItem({ code: "OVERSOLD" }, q);

  await recordMovement({ itemId: item.id, in: 10, refType: "po" }, q);
  await recordMovement({ itemId: item.id, out: 25, refType: "dr" }, q);
  // 10 - 25 = -15
  expect(await currentStock(item.id, q)).toBe(-15);
  await db.close();
});

test("currentStock counts only the asked-for item", async () => {
  const db = await createTestDb();
  const q = executor(db);
  const a = await createItem({ code: "A" }, q);
  const b = await createItem({ code: "B" }, q);

  await recordMovement({ itemId: a.id, in: 100, refType: "po" }, q);
  await recordMovement({ itemId: b.id, in: 7, refType: "po" }, q);

  expect(await currentStock(a.id, q)).toBe(100);
  expect(await currentStock(b.id, q)).toBe(7);
  await db.close();
});

test("stockByItem returns one stock row per item with the correct balance", async () => {
  const db = await createTestDb();
  const q = executor(db);
  const a = await createItem({ code: "AAA", description: "Item A" }, q);
  const b = await createItem({ code: "BBB", description: "Item B" }, q);

  await recordMovement({ itemId: a.id, in: 200, refType: "po" }, q);
  await recordMovement({ itemId: a.id, out: 75, refType: "dr" }, q);
  await recordMovement({ itemId: b.id, in: 40, refType: "po" }, q);

  const rows = await stockByItem(q);
  const byId = new Map(rows.map((r) => [r.item_id, r]));
  expect(byId.get(a.id)?.stock).toBe(125); // 200 - 75
  expect(byId.get(a.id)?.code).toBe("AAA"); // joined from items
  expect(byId.get(b.id)?.stock).toBe(40);
  await db.close();
});

test("recordMovement rejects an empty movement (neither in nor out)", async () => {
  const db = await createTestDb();
  const q = executor(db);
  const item = await createItem({ code: "DEF" }, q);

  // a movement with no in and no out moves no stock — it is rejected so the
  // ledger never accumulates meaningless rows.
  await expect(
    recordMovement({ itemId: item.id, refType: "po" }, q)
  ).rejects.toThrow();
  await db.close();
});

test("recordMovement rejects a negative quantity", async () => {
  const db = await createTestDb();
  const q = executor(db);
  const item = await createItem({ code: "NEG" }, q);

  await expect(
    recordMovement({ itemId: item.id, in: -5, refType: "po" }, q)
  ).rejects.toThrow();
  await expect(
    recordMovement({ itemId: item.id, out: -5, refType: "dr" }, q)
  ).rejects.toThrow();
  // and nothing was written for either rejected attempt
  expect(await currentStock(item.id, q)).toBe(0);
  await db.close();
});

test("recordMovement rejects a movement carrying BOTH an in and an out", async () => {
  const db = await createTestDb();
  const q = executor(db);
  const item = await createItem({ code: "BOTH" }, q);

  // a single row with in>0 AND out>0 would silently corrupt sum(in)-sum(out)
  await expect(
    recordMovement({ itemId: item.id, in: 10, out: 3, refType: "po" }, q)
  ).rejects.toThrow();
  expect(await currentStock(item.id, q)).toBe(0);
  await db.close();
});

test("recordMovement routes refId to the column for its refType", async () => {
  const db = await createTestDb();
  const q = executor(db);
  const item = await createItem({ code: "ROUTE" }, q);

  const dr = await recordMovement(
    { itemId: item.id, out: 5, refType: "dr", refId: "DR00000001" },
    q
  );
  expect(dr.dr_id).toBe("DR00000001");
  expect(dr.po_id).toBeNull();

  const ds = await recordMovement(
    { itemId: item.id, out: 3, refType: "dscrp", refId: "DS00000001" },
    q
  );
  expect(ds.dscrp_id).toBe("DS00000001");

  const ret = await recordMovement(
    { itemId: item.id, in: 2, refType: "return", refId: "RT00000001" },
    q
  );
  expect(ret.return_id).toBe("RT00000001");
  await db.close();
});

test("recordMovement tags the tenant as fastrak and a unique 10-char id", async () => {
  const db = await createTestDb();
  const q = executor(db);
  const item = await createItem({ code: "TEN" }, q);

  const a = await recordMovement({ itemId: item.id, in: 1, refType: "po" }, q);
  const b = await recordMovement({ itemId: item.id, in: 1, refType: "po" }, q);
  expect(a.id).toHaveLength(10);
  expect(a.id).not.toBe(b.id);

  const rows = await q("select tenant_id from inventory where id = $1", [a.id]);
  expect(rows[0]?.tenant_id).toBe("fastrak");
  await db.close();
});

test("recordMovement rejects a movement for an item that does not exist", async () => {
  const db = await createTestDb();
  const q = executor(db);
  await expect(
    recordMovement({ itemId: "NOSUCHITEM", in: 1, refType: "po" }, q)
  ).rejects.toThrow();
  await db.close();
});

test("listMovements can filter to a single item, newest first", async () => {
  const db = await createTestDb();
  const q = executor(db);
  const a = await createItem({ code: "FA" }, q);
  const b = await createItem({ code: "FB" }, q);

  await recordMovement(
    { itemId: a.id, in: 1, refType: "po", date: "2024-01-01" },
    q
  );
  await recordMovement(
    { itemId: a.id, out: 1, refType: "dr", date: "2024-03-01" },
    q
  );
  await recordMovement(
    { itemId: b.id, in: 1, refType: "po", date: "2024-02-01" },
    q
  );

  const forA = await listMovements(q, a.id);
  expect(forA).toHaveLength(2);
  // newest movement_date first
  expect(forA[0]?.movement_date).toBe("2024-03-01");
  expect(forA[1]?.movement_date).toBe("2024-01-01");
  await db.close();
});
