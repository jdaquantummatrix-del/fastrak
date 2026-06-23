// Import fastrak's coldet.dbf (Collection detail lines) into the local dev database
// (PGlite). Field mapping: db/schema/0019_coldet.sql. Preserves legacy CIDs
// (ADR-0002). Run after import-col.mjs (lines reference their header).
//
// Notes:
//  - YAMOUNT is the amount applied to the line's A/R row (Y-currency 8-byte int /
//    10000); dbf.mjs decodes it to a number — we keep it as a fixed-2-decimal string
//    so numeric(14,2) stays exact (no binary-float artifact).
//  - DDUE / DDATE are D dates; dbf.mjs decodes them to "YYYY-MM-DD" (or null). CDRNO
//    is the snapshot of the settled A/R's DR number.
//  - CCOLID -> col(id), CARID -> ar(id) and CCUSTID -> customers(id) are foreign keys.
//    If a referenced header / A/R row / customer was not migrated, we null that FK
//    rather than fail the import. (The sample ships an EMPTY ar.dbf — receivables are
//    re-raised by posting DRs — so CARID commonly dangles and is nulled.)
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { readDbf } from "./dbf.mjs";

const DBF = path.resolve("incoming/fastrak/fastrak/DATA/coldet.dbf");
const clean = (v) => (typeof v === "string" ? v.trim() || null : v);
// Y currency decoded to a number -> exact 2-decimal string for numeric(14,2).
const money = (v) => (v == null ? "0.00" : Number(v).toFixed(2));

const { records } = readDbf(DBF);
const db = await PGlite.create("./.pglite");

// Resolve which col / ar / customer ids actually exist, so we can null dangling FKs.
const colRows = await db.query("select id from col");
const colIds = new Set(colRows.rows.map((row) => row.id));
const arRows = await db.query("select id from ar");
const arIds = new Set(arRows.rows.map((row) => row.id));
const custRows = await db.query("select id from customers");
const custIds = new Set(custRows.rows.map((row) => row.id));
const fk = (id, set) => (id && set.has(id) ? id : null);

let n = 0;
let dangling = 0;
for (const r of records) {
  const id = clean(r.CID);
  if (!id) continue;

  const colId = clean(r.CCOLID);
  const arId = clean(r.CARID);
  const custId = clean(r.CCUSTID);
  const resolvedCol = fk(colId, colIds);
  const resolvedAr = fk(arId, arIds);
  const resolvedCust = fk(custId, custIds);
  if (
    (colId && !resolvedCol) ||
    (arId && !resolvedAr) ||
    (custId && !resolvedCust)
  ) {
    dangling++;
  }

  await db.query(
    `insert into coldet
       (id, tenant_id, col_id, customer_id, ar_id, dr_no, due_date, ar_date,
        amount, updated_at)
     values ($1,'fastrak',$2,$3,$4,$5,$6,$7,$8, now())
     on conflict (id) do update set
       col_id=excluded.col_id, customer_id=excluded.customer_id,
       ar_id=excluded.ar_id, dr_no=excluded.dr_no, due_date=excluded.due_date,
       ar_date=excluded.ar_date, amount=excluded.amount, updated_at=now()`,
    [
      id,
      resolvedCol,
      resolvedCust,
      resolvedAr,
      clean(r.CDRNO),
      clean(r.DDUE),
      clean(r.DDATE),
      money(r.YAMOUNT)
    ]
  );
  n++;
}

await db.close();
console.log(`imported ${n} collection line(s) from ${path.basename(DBF)}`);
if (dangling) {
  console.log(`  (${dangling} line(s) had dangling col/ar/customer refs — nulled)`);
}
