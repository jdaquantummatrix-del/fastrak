import { test, expect } from "vitest";
import { createTestDb } from "./test-db";
import {
  listCustomerTypes,
  createCustomerType,
  updateCustomerType,
  deleteCustomerType,
  getCustomerType
} from "./customer-types";

const runner = (db: Awaited<ReturnType<typeof createTestDb>>) => (
  text: string,
  params?: unknown[]
) => db.query(text, params).then((r) => r.rows as Record<string, unknown>[]);

test("schema pre-seeds Wholesale, Retail, Distributor", async () => {
  const db = await createTestDb();
  const q = runner(db);

  const types = await listCustomerTypes(q);
  const names = types.map((t) => t.name);
  expect(names).toContain("Wholesale");
  expect(names).toContain("Retail");
  expect(names).toContain("Distributor");
  await db.close();
});

test("createCustomerType then listCustomerTypes returns the new row", async () => {
  const db = await createTestDb();
  const q = runner(db);

  const created = await createCustomerType({ name: "Walk-in", remarks: "cash only" }, q);
  expect(created.name).toBe("Walk-in");
  expect(created.id).toHaveLength(10);

  const fetched = await getCustomerType(created.id, q);
  expect(fetched?.name).toBe("Walk-in");
  await db.close();
});

test("updateCustomerType renames the type", async () => {
  const db = await createTestDb();
  const q = runner(db);

  const created = await createCustomerType({ name: "Old" }, q);
  await updateCustomerType(created.id, { name: "New" }, q);

  const fetched = await getCustomerType(created.id, q);
  expect(fetched?.name).toBe("New");
  await db.close();
});

test("createCustomerType rejects a blank name", async () => {
  const db = await createTestDb();
  const q = runner(db);

  await expect(createCustomerType({ name: "" }, q)).rejects.toThrow();
  await db.close();
});

test("createCustomerType rejects a duplicate name (case-insensitive)", async () => {
  const db = await createTestDb();
  const q = runner(db);

  // "Wholesale" is already seeded.
  await expect(createCustomerType({ name: "wholesale" }, q)).rejects.toThrow(
    /already exists/
  );
  await db.close();
});

test("updateCustomerType rejects renaming onto an existing name", async () => {
  const db = await createTestDb();
  const q = runner(db);

  const created = await createCustomerType({ name: "Temp" }, q);
  await expect(
    updateCustomerType(created.id, { name: "Retail" }, q)
  ).rejects.toThrow(/already exists/);
  await db.close();
});

test("deleteCustomerType removes the row", async () => {
  const db = await createTestDb();
  const q = runner(db);

  const created = await createCustomerType({ name: "Temp" }, q);
  await deleteCustomerType(created.id, q);

  expect(await getCustomerType(created.id, q)).toBeNull();
  await db.close();
});

test("deleteCustomerType throws for an unknown id", async () => {
  const db = await createTestDb();
  const q = runner(db);

  await expect(deleteCustomerType("NOPE000000", q)).rejects.toThrow(/not found/);
  await db.close();
});
