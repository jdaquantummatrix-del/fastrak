// Import fastrak's unit.dbf into the local dev database (PGlite).
// Field mapping: db/schema/0002_units.sql. Preserves legacy CIDs (ADR-0002).
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { readDbf } from "./dbf.mjs";

const DBF = path.resolve("incoming/fastrak/fastrak/DATA/unit.dbf");
const clean = (v) => (typeof v === "string" ? v.trim() || null : v);

const { records } = readDbf(DBF);
const db = await PGlite.create("./.pglite");

let n = 0;
for (const r of records) {
  const id = clean(r.CID);
  if (!id) continue;
  await db.query(
    `insert into units (id, tenant_id, unit, updated_at)
     values ($1, 'fastrak', $2, now())
     on conflict (id) do update set unit = excluded.unit, updated_at = now()`,
    [id, clean(r.CUNIT)]
  );
  n++;
}

await db.close();
console.log(`imported ${n} unit(s) from ${path.basename(DBF)}`);
