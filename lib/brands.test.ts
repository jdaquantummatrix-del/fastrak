import { test, expect } from "vitest";
import { createTestDb } from "./test-db";
import { listBrands, createBrand, updateBrand } from "./brands";

test("createBrand then listBrands returns the new row", async () => {
  const db = await createTestDb();
  const q = (text: string, params?: unknown[]) =>
    db.query(text, params).then((r) => r.rows as Record<string, unknown>[]);

  const created = await createBrand({ brand: "Bosch", remarks: "power tools" }, q);
  expect(created.brand).toBe("Bosch");
  expect(created.id).toHaveLength(10);

  const brands = await listBrands(q);
  expect(brands).toHaveLength(1);
  expect(brands[0]?.brand).toBe("Bosch");
  await db.close();
});

test("updateBrand changes the brand value", async () => {
  const db = await createTestDb();
  const q = (text: string, params?: unknown[]) =>
    db.query(text, params).then((r) => r.rows as Record<string, unknown>[]);

  const created = await createBrand({ brand: "Old" }, q);
  await updateBrand(created.id, { brand: "New" }, q);

  const brands = await listBrands(q);
  expect(brands[0]?.brand).toBe("New");
  await db.close();
});

test("createBrand rejects a blank brand", async () => {
  const db = await createTestDb();
  const q = (text: string, params?: unknown[]) =>
    db.query(text, params).then((r) => r.rows as Record<string, unknown>[]);

  await expect(createBrand({ brand: "   " }, q)).rejects.toThrow();
  await db.close();
});
