import { test, expect } from "vitest";
import { createTestDb, asDb } from "./test-db";
import {
  addCustomerOption,
  addItemOption,
  addSupplierOption,
  customerOptionLabel,
  itemOptionLabel,
  supplierOptionLabel,
  type PickerOption
} from "./picker-add";
import { listCustomers } from "./customers";
import { listItems } from "./items";
import { listSuppliers } from "./suppliers";

// A PGlite-backed executor matching the lib/db.ts `query` shape.
function executor(db: Awaited<ReturnType<typeof createTestDb>>) {
  return (text: string, params?: unknown[]) =>
    db.query(text, params).then((r) => r.rows as Record<string, unknown>[]);
}

test("addCustomerOption creates the customer and returns its id + name as the option", async () => {
  const db = await createTestDb();
  const q = executor(db);

  const opt: PickerOption = await addCustomerOption({ name: "Walk-in Co" }, q);

  // The new record actually exists (reused write path, not a stub).
  const customers = await listCustomers(q);
  expect(customers).toHaveLength(1);
  expect(customers[0]?.id).toBe(opt.value);

  // The returned option is what the picker auto-selects: id as value, name as label.
  expect(opt.value).toHaveLength(10);
  expect(opt.label).toBe("Walk-in Co");
  await db.close();
});

test("addSupplierOption creates the supplier and returns its id + name as the option", async () => {
  const db = await createTestDb();
  const q = executor(db);

  const opt = await addSupplierOption({ name: "New Vendor" }, q);

  const suppliers = await listSuppliers(q);
  expect(suppliers).toHaveLength(1);
  expect(suppliers[0]?.id).toBe(opt.value);
  expect(opt.value).toHaveLength(10);
  expect(opt.label).toBe("New Vendor");
  await db.close();
});

test("addItemOption creates the item and returns its id + 'code — description' label", async () => {
  const db = await createTestDb();
  const q = executor(db);

  const opt = await addItemOption(
    { code: "WIDGET-1", description: "Blue widget" },
    q
  );

  const items = await listItems(q);
  expect(items).toHaveLength(1);
  expect(items[0]?.id).toBe(opt.value);
  expect(opt.value).toHaveLength(10);
  expect(opt.label).toBe("WIDGET-1 — Blue widget");
  await db.close();
});

test("addItemOption labels a description-less item with just its code", async () => {
  const db = await createTestDb();
  const q = executor(db);

  const opt = await addItemOption({ code: "BARE-CODE" }, q);
  expect(opt.label).toBe("BARE-CODE");
  await db.close();
});

test("the add-* helpers run through asDb (same Executor wiring as the app)", async () => {
  const db = await createTestDb();
  const appDb = asDb(db);

  const opt = await addCustomerOption({ name: "Via appDb" }, appDb.query);
  const customers = await listCustomers(appDb.query);
  expect(customers[0]?.id).toBe(opt.value);
  expect(opt.label).toBe("Via appDb");
  await db.close();
});

test("a blank required field still rejects through the add-* helper (lenient create unchanged)", async () => {
  const db = await createTestDb();
  const q = executor(db);

  // The escape hatch reuses createCustomer/createItem, so name/code is still required.
  await expect(addCustomerOption({ name: "  " }, q)).rejects.toThrow();
  await expect(addItemOption({ code: "" }, q)).rejects.toThrow();
  await db.close();
});

test("label formatters are the single source of truth for the picker labels", async () => {
  expect(customerOptionLabel({ id: "X", name: "Acme" } as never)).toBe("Acme");
  expect(customerOptionLabel({ id: "FALLBACK", name: null } as never)).toBe(
    "FALLBACK"
  );
  expect(supplierOptionLabel({ id: "Y", name: "Vendor" } as never)).toBe("Vendor");
  expect(
    itemOptionLabel({ id: "Z", code: "C1", description: "Thing" } as never)
  ).toBe("C1 — Thing");
  expect(itemOptionLabel({ id: "NOCODE", code: null } as never)).toBe("NOCODE");
});
