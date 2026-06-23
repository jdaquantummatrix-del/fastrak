// Import fastrak's drdet.dbf (Delivery Receipt detail lines) into the local dev
// database (PGlite). Field mapping: db/schema/0013_drdet.sql. Preserves legacy CIDs
// (ADR-0002). Run after import-dr.mjs (lines reference their header).
//
// Notes:
//  - YPRICE/YBASE are Y-currency; dbf.mjs decodes them (8-byte int / 10000) to a
//    number. We store them as fixed-2-decimal strings so numeric(14,2) keeps an
//    exact value with no binary-float artifact.
//  - NQTY (boxes) and NQTY2 (pieces = NQTY * NPACK) are both kept; fastrak's money
//    math and inventory posting operate on NQTY2 (see lib/dr.ts). NDISC/NDISC2 are
//    per-line discount %s; NPACK / NSEQ keep their decimals (numeric columns).
//  - CDRID -> dr(id) and CITEMID -> items(id) are foreign keys. If a referenced
//    header or item was not migrated, we null that FK rather than fail the import.
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { readDbf } from "./dbf.mjs";

const DBF = path.resolve("incoming/fastrak/fastrak/DATA/drdet.dbf");
const clean = (v) => (typeof v === "string" ? v.trim() || null : v);
const count = (v) => (v == null ? 0 : Math.trunc(v));
const pct = (v) => (v == null ? 0 : Number(v).toFixed(2));
// Y currency decoded to a number -> exact 2-decimal string for numeric(14,2).
const money = (v) => (v == null ? null : Number(v).toFixed(2));
// keep the raw decimal for NPACK/NSEQ numeric columns (null when blank)
const dec = (v) => (v == null ? null : Number(v));

const { records } = readDbf(DBF);
const db = await PGlite.create("./.pglite");

// Resolve which dr/item ids actually exist, so we can null dangling FKs.
const drRows = await db.query("select id from dr");
const drIds = new Set(drRows.rows.map((row) => row.id));
const itemRows = await db.query("select id from items");
const itemIds = new Set(itemRows.rows.map((row) => row.id));
const fk = (id, set) => (id && set.has(id) ? id : null);

let n = 0;
let dangling = 0;
for (const r of records) {
  const id = clean(r.CID);
  if (!id) continue;

  const drId = clean(r.CDRID);
  const itemId = clean(r.CITEMID);
  const resolvedDr = fk(drId, drIds);
  const resolvedItem = fk(itemId, itemIds);
  if ((drId && !resolvedDr) || (itemId && !resolvedItem)) dangling++;

  await db.query(
    `insert into drdet
       (id, tenant_id, dr_id, item_id, description, code, price, base_cost, qty,
        unit, disc, disc2, pack_size, qty2, unit2, seq, updated_at)
     values ($1,'fastrak',$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15, now())
     on conflict (id) do update set
       dr_id=excluded.dr_id, item_id=excluded.item_id, description=excluded.description,
       code=excluded.code, price=excluded.price, base_cost=excluded.base_cost,
       qty=excluded.qty, unit=excluded.unit, disc=excluded.disc, disc2=excluded.disc2,
       pack_size=excluded.pack_size, qty2=excluded.qty2, unit2=excluded.unit2,
       seq=excluded.seq, updated_at=now()`,
    [
      id,
      resolvedDr,
      resolvedItem,
      clean(r.CDESC),
      clean(r.CCODE),
      money(r.YPRICE),
      money(r.YBASE),
      count(r.NQTY),
      clean(r.CUNIT),
      pct(r.NDISC),
      pct(r.NDISC2),
      dec(r.NPACK),
      count(r.NQTY2),
      clean(r.CUNIT2),
      dec(r.NSEQ)
    ]
  );
  n++;
}

await db.close();
console.log(`imported ${n} DR line(s) from ${path.basename(DBF)}`);
if (dangling) {
  console.log(`  (${dangling} line(s) had dangling dr/item refs — nulled)`);
}
