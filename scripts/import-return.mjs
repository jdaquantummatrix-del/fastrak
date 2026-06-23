// Import fastrak's return.dbf (Return headers) into the local dev database (PGlite).
// Field mapping: db/schema/0016_return.sql. Preserves legacy CIDs (ADR-0002).
//
// Notes:
//  - DDATE is a D date; dbf.mjs decodes it to "YYYY-MM-DD" (or null).
//  - LPOST -> posted, LAPPLIED -> applied (nullable logical).
//  - CCUSTID is a FK to customers(id) and CDRID a FK to dr(id) — the original
//    Delivery Receipt. If the referenced row was not migrated, we null the FK rather
//    than fail the import. CRETCUST / CRETAR / CBONO are legacy free-text links.
//  - Detail lines come from import-returndet.mjs (run after this).
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { readDbf } from "./dbf.mjs";

const DBF = path.resolve("incoming/fastrak/fastrak/DATA/return.dbf");
const clean = (v) => (typeof v === "string" ? v.trim() || null : v);

const { records } = readDbf(DBF);
const db = await PGlite.create("./.pglite");

// Resolve which customer / DR ids actually exist, so we can null dangling FKs.
const custRows = await db.query("select id from customers");
const custIds = new Set(custRows.rows.map((row) => row.id));
const drRows = await db.query("select id from dr");
const drIds = new Set(drRows.rows.map((row) => row.id));
const fk = (id, set) => (id && set.has(id) ? id : null);

let n = 0;
let danglingCust = 0;
let danglingDr = 0;
for (const r of records) {
  const id = clean(r.CID);
  if (!id) continue;

  const custId = clean(r.CCUSTID);
  const resolvedCust = fk(custId, custIds);
  if (custId && !resolvedCust) danglingCust++;

  const drId = clean(r.CDRID);
  const resolvedDr = fk(drId, drIds);
  if (drId && !resolvedDr) danglingDr++;

  await db.query(
    `insert into return
       (id, tenant_id, customer_id, return_date, remarks, ret_customer, ret_ar,
        bo_no, applied, dr_id, type, posted, updated_at)
     values ($1,'fastrak',$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, now())
     on conflict (id) do update set
       customer_id=excluded.customer_id, return_date=excluded.return_date,
       remarks=excluded.remarks, ret_customer=excluded.ret_customer,
       ret_ar=excluded.ret_ar, bo_no=excluded.bo_no, applied=excluded.applied,
       dr_id=excluded.dr_id, type=excluded.type, posted=excluded.posted,
       updated_at=now()`,
    [
      id,
      resolvedCust,
      clean(r.DDATE),
      clean(r.CREMARKS),
      clean(r.CRETCUST),
      clean(r.CRETAR),
      clean(r.CBONO),
      r.LAPPLIED ?? null,
      resolvedDr,
      clean(r.CTYPE),
      r.LPOST ?? false
    ]
  );
  n++;
}

await db.close();
console.log(`imported ${n} return(s) from ${path.basename(DBF)}`);
if (danglingCust) {
  console.log(`  (${danglingCust} return(s) had dangling customer refs — nulled)`);
}
if (danglingDr) {
  console.log(`  (${danglingDr} return(s) had dangling DR refs — nulled)`);
}
