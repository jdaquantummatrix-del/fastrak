// Import fastrak's returndet.dbf (Return detail lines) into the local dev database
// (PGlite). Field mapping: db/schema/0017_returndet.sql. Preserves legacy CIDs
// (ADR-0002). Run after import-return.mjs (lines reference their header).
//
// Notes:
//  - YPRICE/YBASE are Y-currency; dbf.mjs decodes them (8-byte int / 10000) to a
//    number. We store them as fixed-2-decimal strings so numeric(14,2) keeps an
//    exact value with no binary-float artifact.
//  - NQTY is the returned quantity (in CUNIT). fastrak's return posting moves stock
//    by NQTY directly (a return line has no NQTY2/NPACK). NDISC/NDISC2 are per-line
//    discount %s. LGOOD flags a resalable line (only LGOOD lines restock on post).
//  - CRETID -> return(id) and CITEMID -> items(id) are foreign keys. If a referenced
//    header or item was not migrated, we null that FK rather than fail the import.
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { readDbf } from "./dbf.mjs";

const DBF = path.resolve("incoming/fastrak/fastrak/DATA/returndet.dbf");
const clean = (v) => (typeof v === "string" ? v.trim() || null : v);
const count = (v) => (v == null ? 0 : Math.trunc(v));
const pct = (v) => (v == null ? 0 : Number(v).toFixed(2));
// Y currency decoded to a number -> exact 2-decimal string for numeric(14,2).
const money = (v) => (v == null ? null : Number(v).toFixed(2));

const { records } = readDbf(DBF);
const db = await PGlite.create("./.pglite");

// Resolve which return/item ids actually exist, so we can null dangling FKs.
const retRows = await db.query("select id from return");
const retIds = new Set(retRows.rows.map((row) => row.id));
const itemRows = await db.query("select id from items");
const itemIds = new Set(itemRows.rows.map((row) => row.id));
const fk = (id, set) => (id && set.has(id) ? id : null);

let n = 0;
let dangling = 0;
for (const r of records) {
  const id = clean(r.CID);
  if (!id) continue;

  const retId = clean(r.CRETID);
  const itemId = clean(r.CITEMID);
  const resolvedRet = fk(retId, retIds);
  const resolvedItem = fk(itemId, itemIds);
  if ((retId && !resolvedRet) || (itemId && !resolvedItem)) dangling++;

  await db.query(
    `insert into returndet
       (id, tenant_id, return_id, item_id, qty, unit, price, base_cost,
        description, code, disc, disc2, good, updated_at)
     values ($1,'fastrak',$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12, now())
     on conflict (id) do update set
       return_id=excluded.return_id, item_id=excluded.item_id, qty=excluded.qty,
       unit=excluded.unit, price=excluded.price, base_cost=excluded.base_cost,
       description=excluded.description, code=excluded.code, disc=excluded.disc,
       disc2=excluded.disc2, good=excluded.good, updated_at=now()`,
    [
      id,
      resolvedRet,
      resolvedItem,
      count(r.NQTY),
      clean(r.CUNIT),
      money(r.YPRICE),
      money(r.YBASE),
      clean(r.CDESC),
      clean(r.CCODE),
      pct(r.NDISC),
      pct(r.NDISC2),
      r.LGOOD ?? null
    ]
  );
  n++;
}

await db.close();
console.log(`imported ${n} return line(s) from ${path.basename(DBF)}`);
if (dangling) {
  console.log(`  (${dangling} line(s) had dangling return/item refs — nulled)`);
}
