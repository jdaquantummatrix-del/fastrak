// Import fastrak's supplier.dbf into the local dev database (PGlite).
// Field mapping: db/schema/0005_suppliers.sql. Preserves legacy CIDs (ADR-0002).
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { readDbf } from "./dbf.mjs";

const DBF = path.resolve("incoming/fastrak/fastrak/DATA/supplier.dbf");
const clean = (v) => (typeof v === "string" ? v.trim() || null : v);

const { records } = readDbf(DBF);
const db = await PGlite.create("./.pglite");

let n = 0;
for (const r of records) {
  const id = clean(r.CID);
  if (!id) continue;
  await db.query(
    `insert into suppliers
       (id, tenant_id, name, terms_days, contact_person, tel_no, fax_no, address, is_local, remarks, updated_at)
     values ($1, 'fastrak', $2, $3, $4, $5, $6, $7, $8, $9, now())
     on conflict (id) do update set
       name = excluded.name, terms_days = excluded.terms_days,
       contact_person = excluded.contact_person, tel_no = excluded.tel_no,
       fax_no = excluded.fax_no, address = excluded.address,
       is_local = excluded.is_local, remarks = excluded.remarks, updated_at = now()`,
    [
      id,
      clean(r.CNAME),
      r.NTERMS ?? null,
      clean(r.CCONTACT),
      clean(r.CTELNO),
      clean(r.CFAX),
      clean(r.CADDRESS),
      r.LLOCAL ?? null,
      clean(r.CREMARKS)
    ]
  );
  n++;
}

await db.close();
console.log(`imported ${n} supplier(s) from ${path.basename(DBF)}`);
