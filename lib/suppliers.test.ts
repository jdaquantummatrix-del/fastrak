import { test, expect } from "vitest";
import { createTestDb } from "./test-db";
import { listSuppliers, createSupplier, updateSupplier } from "./suppliers";

test("createSupplier then listSuppliers returns the new row", async () => {
  const db = await createTestDb();
  const q = (text: string, params?: unknown[]) =>
    db.query(text, params).then((r) => r.rows as Record<string, unknown>[]);

  const created = await createSupplier(
    {
      name: "Acme Imports",
      terms_days: 30,
      contact_person: "Jane Doe",
      tel_no: "02-555-1234",
      fax_no: "02-555-5678",
      address: "12 Industrial Rd",
      is_local: false,
      remarks: "preferred"
    },
    q
  );
  expect(created.name).toBe("Acme Imports");
  expect(created.terms_days).toBe(30);
  expect(created.is_local).toBe(false);

  const suppliers = await listSuppliers(q);
  expect(suppliers).toHaveLength(1);
  expect(suppliers[0]?.name).toBe("Acme Imports");
  await db.close();
});

test("createSupplier generates a unique 10-char text id", async () => {
  const db = await createTestDb();
  const q = (text: string, params?: unknown[]) =>
    db.query(text, params).then((r) => r.rows as Record<string, unknown>[]);

  const a = await createSupplier({ name: "Supplier A" }, q);
  const b = await createSupplier({ name: "Supplier B" }, q);
  expect(a.id).toHaveLength(10);
  expect(b.id).toHaveLength(10);
  expect(a.id).not.toBe(b.id);
  await db.close();
});

test("updateSupplier changes fields", async () => {
  const db = await createTestDb();
  const q = (text: string, params?: unknown[]) =>
    db.query(text, params).then((r) => r.rows as Record<string, unknown>[]);

  const created = await createSupplier({ name: "Old Name", terms_days: 15 }, q);
  await updateSupplier(
    created.id,
    { name: "New Name", terms_days: 45, is_local: true },
    q
  );

  const suppliers = await listSuppliers(q);
  expect(suppliers[0]?.name).toBe("New Name");
  expect(suppliers[0]?.terms_days).toBe(45);
  expect(suppliers[0]?.is_local).toBe(true);
  await db.close();
});

test("createSupplier rejects a blank name", async () => {
  const db = await createTestDb();
  const q = (text: string, params?: unknown[]) =>
    db.query(text, params).then((r) => r.rows as Record<string, unknown>[]);

  await expect(createSupplier({ name: "  " }, q)).rejects.toThrow();
  await db.close();
});
