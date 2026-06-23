// Import fastrak's dr.dbf (Delivery Receipt headers) into the local dev database
// (PGlite). Field mapping: db/schema/0012_dr.sql. Preserves legacy CIDs (ADR-0002).
//
// Notes:
//  - DDATE is a D date; dbf.mjs decodes it to "YYYY-MM-DD" (or null).
//  - NDRDISC/NDRDISC2/NADD are N percentages; NADD is the add-on %, NDRDISC the
//    document discount %. YADD is fastrak's *stored* add-on currency (Y-currency,
//    8-byte int / 10000) — dbf.mjs already decodes it to a number; we keep it as a
//    fixed-2-decimal string so numeric(14,2) stays exact (no binary-float artifact).
//    lib/dr.ts recomputes the same value from net*(NADD/100) and the fidelity tests
//    prove they match.
//  - LPOST -> posted, LCANCEL -> cancelled, LRCVDR -> received.
//  - CCUSTID is a foreign key to customers(id). If the referenced customer was not
//    migrated, we null the FK rather than fail the import.
//  - Detail lines come from import-drdet.mjs (run after this).
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { readDbf } from "./dbf.mjs";

const DBF = path.resolve("incoming/fastrak/fastrak/DATA/dr.dbf");
const clean = (v) => (typeof v === "string" ? v.trim() || null : v);
const count = (v) => (v == null ? 0 : Math.trunc(v));
const pct = (v) => (v == null ? 0 : Number(v).toFixed(2));
// Y currency decoded to a number -> exact 2-decimal string for numeric(14,2).
const money = (v) => (v == null ? "0.00" : Number(v).toFixed(2));

const { records } = readDbf(DBF);
const db = await PGlite.create("./.pglite");

// Resolve which customer ids actually exist, so we can null dangling FKs.
const custRows = await db.query("select id from customers");
const custIds = new Set(custRows.rows.map((row) => row.id));
const fk = (id, set) => (id && set.has(id) ? id : null);

let n = 0;
let dangling = 0;
for (const r of records) {
  const id = clean(r.CID);
  if (!id) continue;

  const custId = clean(r.CCUSTID);
  const resolvedCust = fk(custId, custIds);
  if (custId && !resolvedCust) dangling++;

  await db.query(
    `insert into dr
       (id, tenant_id, dr_no, customer_id, address, dr_date, remarks, terms_days,
        po_no, doc_disc, doc_disc2, add_pct, add_amount, type, dr_si,
        posted, cancelled, received, updated_at)
     values ($1,'fastrak',$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17, now())
     on conflict (id) do update set
       dr_no=excluded.dr_no, customer_id=excluded.customer_id, address=excluded.address,
       dr_date=excluded.dr_date, remarks=excluded.remarks, terms_days=excluded.terms_days,
       po_no=excluded.po_no, doc_disc=excluded.doc_disc, doc_disc2=excluded.doc_disc2,
       add_pct=excluded.add_pct, add_amount=excluded.add_amount, type=excluded.type,
       dr_si=excluded.dr_si, posted=excluded.posted, cancelled=excluded.cancelled,
       received=excluded.received, updated_at=now()`,
    [
      id,
      clean(r.CDRNO),
      resolvedCust,
      clean(r.CADDRESS),
      clean(r.DDATE),
      clean(r.CREMARKS),
      count(r.NTERMS),
      clean(r.CPONO),
      pct(r.NDRDISC),
      pct(r.NDRDISC2),
      pct(r.NADD),
      money(r.YADD),
      clean(r.CTYPE),
      clean(r.CDRSI),
      r.LPOST ?? false,
      r.LCANCEL ?? false,
      r.LRCVDR ?? null
    ]
  );
  n++;
}

await db.close();
console.log(`imported ${n} delivery receipt(s) from ${path.basename(DBF)}`);
if (dangling) {
  console.log(`  (${dangling} DR(s) had dangling customer refs — nulled)`);
}
