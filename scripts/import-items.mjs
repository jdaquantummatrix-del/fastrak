// Import fastrak's item.dbf into the local dev database (PGlite).
// Field mapping: db/schema/0006_items.sql. Preserves legacy CIDs (ADR-0002).
//
// Notes:
//  - YBASE/YPRICE/YRETAIL are Y-currency (8-byte int / 10000); scripts/dbf.mjs
//    already decodes them to plain decimal numbers, which Postgres stores as
//    numeric(14,2) with no float drift.
//  - CUNIT/CUNIT2 hold the unit *text* (e.g. "BOX"), not a unit id.
//  - CCATEGID/CBRANDID/CSUPPID are foreign keys. If the referenced row was not
//    migrated (sample data has dangling refs), we null the FK rather than fail
//    the whole import — the legacy value is preserved for any later backfill.
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { readDbf } from "./dbf.mjs";

const DBF = path.resolve("incoming/fastrak/fastrak/DATA/item.dbf");
const clean = (v) => (typeof v === "string" ? v.trim() || null : v);

const { records } = readDbf(DBF);
const db = await PGlite.create("./.pglite");

// Resolve which reference ids actually exist, so we can null dangling FKs.
async function existingIds(table) {
  const r = await db.query(`select id from ${table}`);
  return new Set(r.rows.map((row) => row.id));
}
const categoryIds = await existingIds("categories");
const brandIds = await existingIds("brands");
const supplierIds = await existingIds("suppliers");
const fk = (id, set) => (id && set.has(id) ? id : null);

let n = 0;
let dangling = 0;
for (const r of records) {
  const id = clean(r.CID);
  if (!id) continue;

  const categoryId = clean(r.CCATEGID);
  const brandId = clean(r.CBRANDID);
  const supplierId = clean(r.CSUPPID);
  const resolvedCategory = fk(categoryId, categoryIds);
  const resolvedBrand = fk(brandId, brandIds);
  const resolvedSupplier = fk(supplierId, supplierIds);
  if (
    (categoryId && !resolvedCategory) ||
    (brandId && !resolvedBrand) ||
    (supplierId && !resolvedSupplier)
  ) {
    dangling++;
  }

  await db.query(
    `insert into items
       (id, tenant_id, code, description, unit, unit2, pack_size, base_cost,
        price, retail, category_id, brand_id, supplier_id, inactive, critical,
        pic, type, updated_at)
     values ($1,'fastrak',$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16, now())
     on conflict (id) do update set
       code=excluded.code, description=excluded.description, unit=excluded.unit,
       unit2=excluded.unit2, pack_size=excluded.pack_size, base_cost=excluded.base_cost,
       price=excluded.price, retail=excluded.retail, category_id=excluded.category_id,
       brand_id=excluded.brand_id, supplier_id=excluded.supplier_id,
       inactive=excluded.inactive, critical=excluded.critical, pic=excluded.pic,
       type=excluded.type, updated_at=now()`,
    [
      id,
      clean(r.CCODE),
      clean(r.CDESC),
      clean(r.CUNIT),
      clean(r.CUNIT2),
      r.NPACK ?? null,
      r.YBASE ?? null,
      r.YPRICE ?? null,
      r.YRETAIL ?? null,
      resolvedCategory,
      resolvedBrand,
      resolvedSupplier,
      r.LINACTIVE ?? null,
      r.NCRITICAL ?? null,
      clean(r.CPIC),
      clean(r.CTYPE)
    ]
  );
  n++;
}

await db.close();
console.log(`imported ${n} item(s) from ${path.basename(DBF)}`);
if (dangling) {
  console.log(`  (${dangling} item(s) had dangling category/brand/supplier refs — nulled)`);
}
