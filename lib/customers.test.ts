import { test, expect } from "vitest";
import { createTestDb } from "./test-db";
import { listCustomers, createCustomer, updateCustomer } from "./customers";

// A PGlite-backed executor matching the lib/db.ts `query` shape.
function executor(db: Awaited<ReturnType<typeof createTestDb>>) {
  return (text: string, params?: unknown[]) =>
    db.query(text, params).then((r) => r.rows as Record<string, unknown>[]);
}

test("createCustomer then listCustomers returns the new row", async () => {
  const db = await createTestDb();
  const q = executor(db);

  const created = await createCustomer(
    {
      name: "Acme Trading",
      terms_days: 30,
      address: "12 Industrial Rd",
      contact_person: "Jane Doe",
      mobile: "0917-555-1234",
      tel_no: "02-555-1234",
      fax_no: "02-555-5678",
      tin: "123-456-789",
      type: "WHOLESALE",
      remarks: "preferred"
    },
    q
  );
  expect(created.name).toBe("Acme Trading");
  expect(created.terms_days).toBe(30);
  expect(created.type).toBe("WHOLESALE");

  const customers = await listCustomers(q);
  expect(customers).toHaveLength(1);
  expect(customers[0]?.name).toBe("Acme Trading");
  await db.close();
});

test("createCustomer generates a unique 10-char text id", async () => {
  const db = await createTestDb();
  const q = executor(db);

  const a = await createCustomer({ name: "Customer A" }, q);
  const b = await createCustomer({ name: "Customer B" }, q);
  expect(a.id).toHaveLength(10);
  expect(b.id).toHaveLength(10);
  expect(a.id).not.toBe(b.id);
  await db.close();
});

test("createCustomer stores blank strings as null", async () => {
  const db = await createTestDb();
  const q = executor(db);

  const created = await createCustomer(
    { name: "Sparse Co", address: "   ", mobile: "" },
    q
  );
  expect(created.address).toBeNull();
  expect(created.mobile).toBeNull();
  await db.close();
});

test("createCustomer tags the tenant as fastrak", async () => {
  const db = await createTestDb();
  const q = executor(db);

  const created = await createCustomer({ name: "Tenant Co" }, q);
  const rows = await q("select tenant_id from customers where id = $1", [
    created.id
  ]);
  expect(rows[0]?.tenant_id).toBe("fastrak");
  await db.close();
});

test("createCustomer rejects a blank name", async () => {
  const db = await createTestDb();
  const q = executor(db);

  await expect(createCustomer({ name: "  " }, q)).rejects.toThrow();
  await db.close();
});

test("updateCustomer changes fields", async () => {
  const db = await createTestDb();
  const q = executor(db);

  const created = await createCustomer({ name: "Old Name", terms_days: 15 }, q);
  await updateCustomer(
    created.id,
    { name: "New Name", terms_days: 45, type: "RETAIL" },
    q
  );

  const customers = await listCustomers(q);
  expect(customers).toHaveLength(1);
  expect(customers[0]?.name).toBe("New Name");
  expect(customers[0]?.terms_days).toBe(45);
  expect(customers[0]?.type).toBe("RETAIL");
  await db.close();
});

test("updateCustomer rejects a blank name", async () => {
  const db = await createTestDb();
  const q = executor(db);

  const created = await createCustomer({ name: "Keep Me" }, q);
  await expect(updateCustomer(created.id, { name: "" }, q)).rejects.toThrow();
  await db.close();
});
