// Import fastrak's col.dbf (Collection headers) into the local dev database (PGlite).
// Field mapping: db/schema/0018_col.sql. Preserves legacy CIDs (ADR-0002).
//
// Notes:
//  - DDATE is a D date; dbf.mjs decodes it to "YYYY-MM-DD" (or null).
//  - CCUSTID2 is the header's customer link (the per-line CCUSTID on coldet is
//    authoritative). It is a FK to customers(id); if the referenced row was not
//    migrated, we null the FK rather than fail the import.
//  - The collection total is NOT stored on the legacy header — it is the sum of the
//    coldet line amounts (derived on read). Detail lines come from import-coldet.mjs
//    (run after this).
//  - NB: the fastrak sample ships exactly ONE collection (col CID 313), so this
//    commonly imports 1 row.
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { readDbf } from "./dbf.mjs";

const DBF = path.resolve("incoming/fastrak/fastrak/DATA/col.dbf");
const clean = (v) => (typeof v === "string" ? v.trim() || null : v);

const { records } = readDbf(DBF);
const db = await PGlite.create("./.pglite");

// Resolve which customer ids actually exist, so we can null a dangling FK.
const custRows = await db.query("select id from customers");
const custIds = new Set(custRows.rows.map((row) => row.id));
const fk = (id, set) => (id && set.has(id) ? id : null);

let n = 0;
let danglingCust = 0;
for (const r of records) {
  const id = clean(r.CID);
  if (!id) continue;

  const custId = clean(r.CCUSTID2);
  const resolvedCust = fk(custId, custIds);
  if (custId && !resolvedCust) danglingCust++;

  await db.query(
    `insert into col
       (id, tenant_id, col_date, remarks, customer_id, updated_at)
     values ($1,'fastrak',$2,$3,$4, now())
     on conflict (id) do update set
       col_date=excluded.col_date, remarks=excluded.remarks,
       customer_id=excluded.customer_id, updated_at=now()`,
    [id, clean(r.DDATE), clean(r.CREMARKS), resolvedCust]
  );
  n++;
}

await db.close();
console.log(`imported ${n} collection(s) from ${path.basename(DBF)}`);
if (danglingCust) {
  console.log(`  (${danglingCust} collection(s) had dangling customer refs — nulled)`);
}
