import { test, expect } from "vitest";
import { createTestDb } from "./test-db";
import { listItems, getItem, createItem, updateItem } from "./items";
import { createCategory } from "./categories";
import { createBrand } from "./brands";
import { createSupplier } from "./suppliers";

// A PGlite-backed executor matching the lib/db.ts `query` shape.
function executor(db: Awaited<ReturnType<typeof createTestDb>>) {
  return (text: string, params?: unknown[]) =>
    db.query(text, params).then((r) => r.rows as Record<string, unknown>[]);
}

test("createItem then listItems returns the new row", async () => {
  const db = await createTestDb();
  const q = executor(db);

  const created = await createItem(
    {
      code: "SKU-001",
      description: "Widget, blue",
      unit: "BOX",
      unit2: "PCS",
      pack_size: 48,
      base_cost: 10,
      price: 20,
      retail: 25,
      critical: 20,
      type: "Import"
    },
    q
  );
  expect(created.code).toBe("SKU-001");
  expect(created.description).toBe("Widget, blue");
  expect(created.pack_size).toBe(48);

  const items = await listItems(q);
  expect(items).toHaveLength(1);
  expect(items[0]?.code).toBe("SKU-001");
  await db.close();
});

test("createItem keeps money as exact decimal (no float drift)", async () => {
  const db = await createTestDb();
  const q = executor(db);

  // 19.99 / 12.34 / 24.95 round-trip exactly as numeric(14,2) strings.
  const created = await createItem(
    { code: "MONEY", base_cost: 12.34, price: 19.99, retail: 24.95 },
    q
  );
  expect(created.base_cost).toBe("12.34");
  expect(created.price).toBe("19.99");
  expect(created.retail).toBe("24.95");

  // Margin = price - base_cost = 19.99 - 12.34 = 7.65, computed in SQL with no drift.
  const rows = await q(
    "select (price - base_cost) as margin from items where id = $1",
    [created.id]
  );
  expect(rows[0]?.margin).toBe("7.65");
  await db.close();
});

test("createItem generates a unique 10-char text id", async () => {
  const db = await createTestDb();
  const q = executor(db);

  const a = await createItem({ code: "A" }, q);
  const b = await createItem({ code: "B" }, q);
  expect(a.id).toHaveLength(10);
  expect(b.id).toHaveLength(10);
  expect(a.id).not.toBe(b.id);
  await db.close();
});

test("createItem stores blank strings as null", async () => {
  const db = await createTestDb();
  const q = executor(db);

  const created = await createItem(
    { code: "SPARSE", description: "   ", unit: "" },
    q
  );
  expect(created.description).toBeNull();
  expect(created.unit).toBeNull();
  await db.close();
});

test("createItem tags the tenant as fastrak", async () => {
  const db = await createTestDb();
  const q = executor(db);

  const created = await createItem({ code: "TENANT" }, q);
  const rows = await q("select tenant_id from items where id = $1", [created.id]);
  expect(rows[0]?.tenant_id).toBe("fastrak");
  await db.close();
});

test("createItem rejects a blank code", async () => {
  const db = await createTestDb();
  const q = executor(db);

  await expect(createItem({ code: "  " }, q)).rejects.toThrow();
  await db.close();
});

test("createItem stores foreign keys to category, brand and supplier", async () => {
  const db = await createTestDb();
  const q = executor(db);

  const cat = await createCategory({ category: "Beverages" }, q);
  const brand = await createBrand({ brand: "Acme" }, q);
  const supp = await createSupplier({ name: "Acme Imports" }, q);

  const created = await createItem(
    {
      code: "LINKED",
      category_id: cat.id,
      brand_id: brand.id,
      supplier_id: supp.id
    },
    q
  );
  expect(created.category_id).toBe(cat.id);
  expect(created.brand_id).toBe(brand.id);
  expect(created.supplier_id).toBe(supp.id);

  const fetched = await getItem(created.id, q);
  expect(fetched?.category_id).toBe(cat.id);
  await db.close();
});

test("createItem rejects a foreign key that does not exist", async () => {
  const db = await createTestDb();
  const q = executor(db);

  await expect(
    createItem({ code: "BADFK", category_id: "NOSUCHCAT0" }, q)
  ).rejects.toThrow();
  await db.close();
});

test("updateItem changes fields including money and inactive flag", async () => {
  const db = await createTestDb();
  const q = executor(db);

  const created = await createItem(
    { code: "OLD", price: 5, base_cost: 2, inactive: false },
    q
  );
  await updateItem(
    created.id,
    {
      code: "NEW",
      description: "Renamed",
      price: 8.5,
      base_cost: 3.25,
      inactive: true
    },
    q
  );

  const item = await getItem(created.id, q);
  expect(item?.code).toBe("NEW");
  expect(item?.description).toBe("Renamed");
  expect(item?.price).toBe("8.50");
  expect(item?.base_cost).toBe("3.25");
  expect(item?.inactive).toBe(true);
  await db.close();
});

test("updateItem preserves the existing pic when the edit does not supply one", async () => {
  const db = await createTestDb();
  const q = executor(db);

  // an item created with an image path
  const created = await createItem(
    { code: "HASPIC", pic: "items/haspic.jpg" },
    q
  );
  expect(created.pic).toBe("items/haspic.jpg");

  // the edit form has no pic field, so input.pic is undefined — pic must survive
  const updated = await updateItem(
    created.id,
    { code: "HASPIC", description: "now described" },
    q
  );
  expect(updated.description).toBe("now described");
  expect(updated.pic).toBe("items/haspic.jpg");

  // and a fresh read confirms it was not nulled in the DB
  const reread = await getItem(created.id, q);
  expect(reread?.pic).toBe("items/haspic.jpg");
  await db.close();
});

test("updateItem can still set a new pic when one is supplied", async () => {
  const db = await createTestDb();
  const q = executor(db);
  const created = await createItem({ code: "NEWPIC", pic: "old.jpg" }, q);
  const updated = await updateItem(
    created.id,
    { code: "NEWPIC", pic: "new.jpg" },
    q
  );
  expect(updated.pic).toBe("new.jpg");
  await db.close();
});

test("updateItem rejects a blank code", async () => {
  const db = await createTestDb();
  const q = executor(db);

  const created = await createItem({ code: "KEEP" }, q);
  await expect(updateItem(created.id, { code: "" }, q)).rejects.toThrow();
  await db.close();
});

test("getItem returns null for a missing id", async () => {
  const db = await createTestDb();
  const q = executor(db);
  expect(await getItem("DOESNOTEXIST", q)).toBeNull();
  await db.close();
});
