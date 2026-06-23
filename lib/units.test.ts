import { test, expect } from "vitest";
import { createTestDb } from "./test-db";
import { listUnits, createUnit, updateUnit } from "./units";

// External behaviour: create -> list, generated id is 10 chars, update mutates.
test("createUnit then listUnits returns the new row", async () => {
  const db = await createTestDb();
  const q = (text: string, params?: unknown[]) =>
    db.query(text, params).then((r) => r.rows as Record<string, unknown>[]);

  const created = await createUnit({ unit: "BOX" }, q);
  expect(created.unit).toBe("BOX");

  const units = await listUnits(q);
  expect(units).toHaveLength(1);
  expect(units[0]?.unit).toBe("BOX");
  await db.close();
});

test("createUnit generates a unique 10-char text id", async () => {
  const db = await createTestDb();
  const q = (text: string, params?: unknown[]) =>
    db.query(text, params).then((r) => r.rows as Record<string, unknown>[]);

  const a = await createUnit({ unit: "PC" }, q);
  const b = await createUnit({ unit: "BDL" }, q);
  expect(a.id).toHaveLength(10);
  expect(b.id).toHaveLength(10);
  expect(a.id).not.toBe(b.id);
  await db.close();
});

test("updateUnit changes the unit value", async () => {
  const db = await createTestDb();
  const q = (text: string, params?: unknown[]) =>
    db.query(text, params).then((r) => r.rows as Record<string, unknown>[]);

  const created = await createUnit({ unit: "KG" }, q);
  await updateUnit(created.id, { unit: "KGS" }, q);

  const units = await listUnits(q);
  expect(units[0]?.unit).toBe("KGS");
  await db.close();
});

test("createUnit rejects a blank unit", async () => {
  const db = await createTestDb();
  const q = (text: string, params?: unknown[]) =>
    db.query(text, params).then((r) => r.rows as Record<string, unknown>[]);

  await expect(createUnit({ unit: "   " }, q)).rejects.toThrow();
  await db.close();
});
