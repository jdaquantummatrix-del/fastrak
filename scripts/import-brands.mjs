// Import fastrak's brand.dbf into the local dev database (PGlite).
// Field mapping: db/schema/0004_brands.sql. Preserves legacy CIDs (ADR-0002).
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { readDbf } from "./dbf.mjs";

const DBF = path.resolve("incoming/fastrak/fastrak/DATA/brand.dbf");
const clean = (v) => (typeof v === "string" ? v.trim() || null : v);

const { records } = readDbf(DBF);
const db = await PGlite.create("./.pglite");

let n = 0;
for (const r of records) {
  const id = clean(r.CID);
  if (!id) continue;
  await db.query(
    `insert into brands (id, tenant_id, brand, remarks, updated_at)
     values ($1, 'fastrak', $2, $3, now())
     on conflict (id) do update set
       brand = excluded.brand, remarks = excluded.remarks, updated_at = now()`,
    [id, clean(r.CBRAND), clean(r.CREMARKS)]
  );
  n++;
}

await db.close();
console.log(`imported ${n} brand(s) from ${path.basename(DBF)}`);
