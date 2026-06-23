// Import fastrak's po.dbf (Purchase Order headers) into the local dev database
// (PGlite). Field mapping: db/schema/0010_po.sql. Preserves legacy CIDs (ADR-0002).
//
// Notes:
//  - DDATE is a D date; dbf.mjs decodes it to "YYYY-MM-DD" (or null).
//  - LPOST is fastrak's posted/received flag -> received boolean.
//  - CSUPPID is a foreign key to suppliers(id). If the referenced supplier was
//    not migrated (sample data has dangling refs), we null the FK rather than
//    fail the whole import. CSUPPLIER is the legacy free-text supplier name.
//  - Detail lines come from import-podet.mjs (run after this).
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { readDbf } from "./dbf.mjs";

const DBF = path.resolve("incoming/fastrak/fastrak/DATA/po.dbf");
const clean = (v) => (typeof v === "string" ? v.trim() || null : v);

const { records } = readDbf(DBF);
const db = await PGlite.create("./.pglite");

// Resolve which supplier ids actually exist, so we can null dangling FKs.
const supplierRows = await db.query("select id from suppliers");
const supplierIds = new Set(supplierRows.rows.map((row) => row.id));
const fk = (id, set) => (id && set.has(id) ? id : null);

let n = 0;
let dangling = 0;
for (const r of records) {
  const id = clean(r.CID);
  if (!id) continue;

  const suppId = clean(r.CSUPPID);
  const resolvedSupp = fk(suppId, supplierIds);
  if (suppId && !resolvedSupp) dangling++;

  await db.query(
    `insert into po
       (id, tenant_id, po_no, po_date, supplier_id, supplier_name, remarks, received, updated_at)
     values ($1,'fastrak',$2,$3,$4,$5,$6,$7, now())
     on conflict (id) do update set
       po_no=excluded.po_no, po_date=excluded.po_date,
       supplier_id=excluded.supplier_id, supplier_name=excluded.supplier_name,
       remarks=excluded.remarks, received=excluded.received, updated_at=now()`,
    [
      id,
      clean(r.CPONO),
      clean(r.DDATE),
      resolvedSupp,
      clean(r.CSUPPLIER),
      clean(r.CREMARKS),
      r.LPOST ?? false
    ]
  );
  n++;
}

await db.close();
console.log(`imported ${n} purchase order(s) from ${path.basename(DBF)}`);
if (dangling) {
  console.log(`  (${dangling} PO(s) had dangling supplier refs — nulled)`);
}
