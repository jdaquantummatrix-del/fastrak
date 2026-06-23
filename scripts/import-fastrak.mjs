// Import fastrak's customer.dbf into the local dev database (PGlite).
// Field mapping: docs/analysis/fastrak-overview.md
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { readDbf } from "./dbf.mjs";

const DBF = path.resolve("incoming/fastrak/fastrak/DATA/customer.dbf");
const clean = (v) => (typeof v === "string" ? v.trim() || null : v);

const { records } = readDbf(DBF);
const db = await PGlite.create("./.pglite");

let n = 0;
for (const r of records) {
  const id = clean(r.CID);
  if (!id) continue;
  await db.query(
    `insert into customers
       (id, tenant_id, name, terms_days, address, contact_person, mobile, tel_no, fax_no, tin, type, remarks, updated_at)
     values ($1,'fastrak',$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, now())
     on conflict (id) do update set
       name=excluded.name, terms_days=excluded.terms_days, address=excluded.address,
       contact_person=excluded.contact_person, mobile=excluded.mobile, tel_no=excluded.tel_no,
       fax_no=excluded.fax_no, tin=excluded.tin, type=excluded.type, remarks=excluded.remarks,
       updated_at=now()`,
    [
      id,
      clean(r.CNAME),
      r.NTERMS ?? null,
      clean(r.CADDRESS),
      clean(r.CCONTACT),
      clean(r.CMOBILE),
      clean(r.CTELNO),
      clean(r.CFAXNO),
      clean(r.CTIN),
      clean(r.CTYPE),
      clean(r.CREMARKS)
    ]
  );
  n++;
}

await db.close();
console.log(`imported ${n} customer(s) from ${path.basename(DBF)}`);
