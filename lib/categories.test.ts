import { test, expect } from "vitest";
import { createTestDb } from "./test-db";
import { listCategories, createCategory, updateCategory } from "./categories";

test("createCategory then listCategories returns the new row", async () => {
  const db = await createTestDb();
  const q = (text: string, params?: unknown[]) =>
    db.query(text, params).then((r) => r.rows as Record<string, unknown>[]);

  const created = await createCategory({ category: "Hardware", remarks: "tools" }, q);
  expect(created.category).toBe("Hardware");
  expect(created.id).toHaveLength(10);

  const cats = await listCategories(q);
  expect(cats).toHaveLength(1);
  expect(cats[0]?.category).toBe("Hardware");
  await db.close();
});

test("updateCategory changes the category value", async () => {
  const db = await createTestDb();
  const q = (text: string, params?: unknown[]) =>
    db.query(text, params).then((r) => r.rows as Record<string, unknown>[]);

  const created = await createCategory({ category: "Old" }, q);
  await updateCategory(created.id, { category: "New" }, q);

  const cats = await listCategories(q);
  expect(cats[0]?.category).toBe("New");
  await db.close();
});

test("createCategory rejects a blank category", async () => {
  const db = await createTestDb();
  const q = (text: string, params?: unknown[]) =>
    db.query(text, params).then((r) => r.rows as Record<string, unknown>[]);

  await expect(createCategory({ category: "" }, q)).rejects.toThrow();
  await db.close();
});
