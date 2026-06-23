// Import fastrak's company.dbf (the business's own info) into the local dev
// database (PGlite). Field mapping: db/schema/0007_company.sql. Preserves legacy
// CIDs (ADR-0002). company.dbf may be empty in the sample data — that's fine.
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { readDbf } from "./dbf.mjs";

const DBF = path.resolve("incoming/fastrak/fastrak/DATA/company.dbf");
const clean = (v) => (typeof v === "string" ? v.trim() || null : v);

const { records } = readDbf(DBF);
const db = await PGlite.create("./.pglite");

let n = 0;
for (const r of records) {
  const id = clean(r.CID);
  if (!id) continue;
  await db.query(
    `insert into company
       (id, tenant_id, name, address, proprietor, tin, tel_no, fax_no, updated_at)
     values ($1, 'fastrak', $2, $3, $4, $5, $6, $7, now())
     on conflict (id) do update set
       name=excluded.name, address=excluded.address, proprietor=excluded.proprietor,
       tin=excluded.tin, tel_no=excluded.tel_no, fax_no=excluded.fax_no,
       updated_at=now()`,
    [
      id,
      clean(r.CCOMPANY),
      clean(r.CADDRESS),
      clean(r.CPROP),
      clean(r.CTIN),
      clean(r.CTEL),
      clean(r.CFAX)
    ]
  );
  n++;
}

await db.close();
console.log(`imported ${n} company row(s) from ${path.basename(DBF)}`);
