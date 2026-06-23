// Import fastrak's ar.dbf (Accounts Receivable) into the local dev database
// (PGlite). Field mapping: db/schema/0015_ar.sql. Preserves legacy CIDs (ADR-0002).
//
// Notes:
//  - DDATE / DDUE are D dates; dbf.mjs decodes them to "YYYY-MM-DD" (or null). DDUE
//    is fastrak's stored due date (= DDATE + the DR's terms days); we store it as-is.
//  - YAMOUNT is a Y currency (8-byte int / 10000) — dbf.mjs decodes it to a number;
//    we keep it as a fixed-2-decimal string so numeric(14,2) stays exact (no
//    binary-float artifact).
//  - CCUSTID is a FK to customers(id) and CDRID a FK to dr(id). If the referenced
//    row was not migrated, we null the FK rather than fail the import. CRETID
//    (return link) is stored as plain text (the return entity is a later slice).
//  - Run after import-fastrak (customers) and import-dr (DR headers) so the FKs
//    resolve. NB: the fastrak sample ships an EMPTY ar.dbf (receivables are normally
//    re-raised by posting DRs), so this commonly imports 0 rows — that is expected.
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { readDbf } from "./dbf.mjs";

const DBF = path.resolve("incoming/fastrak/fastrak/DATA/ar.dbf");
const clean = (v) => (typeof v === "string" ? v.trim() || null : v);
// Y currency decoded to a number -> exact 2-decimal string for numeric(14,2).
const money = (v) => (v == null ? "0.00" : Number(v).toFixed(2));

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
    `insert into ar
       (id, tenant_id, customer_id, dr_no, po_no, ar_date, due_date, amount,
        remarks, dr_id, return_id, updated_at)
     values ($1,'fastrak',$2,$3,$4,$5,$6,$7,$8,$9,$10, now())
     on conflict (id) do update set
       customer_id=excluded.customer_id, dr_no=excluded.dr_no, po_no=excluded.po_no,
       ar_date=excluded.ar_date, due_date=excluded.due_date, amount=excluded.amount,
       remarks=excluded.remarks, dr_id=excluded.dr_id, return_id=excluded.return_id,
       updated_at=now()`,
    [
      id,
      resolvedCust,
      clean(r.CDRNO),
      clean(r.CPONO),
      clean(r.DDATE),
      clean(r.DDUE),
      money(r.YAMOUNT),
      clean(r.CREMARKS),
      resolvedDr,
      clean(r.CRETID)
    ]
  );
  n++;
}

await db.close();
console.log(`imported ${n} accounts-receivable row(s) from ${path.basename(DBF)}`);
if (danglingCust) {
  console.log(`  (${danglingCust} A/R row(s) had dangling customer refs — nulled)`);
}
if (danglingDr) {
  console.log(`  (${danglingDr} A/R row(s) had dangling DR refs — nulled)`);
}
