// Import fastrak's podet.dbf (Purchase Order detail lines) into the local dev
// database (PGlite). Field mapping: db/schema/0011_podet.sql. Preserves legacy
// CIDs (ADR-0002). Run after import-po.mjs (lines reference their header).
//
// Notes:
//  - YBASE is Y-currency; dbf.mjs already decodes it (8-byte int / 10000) to a
//    number. We pass it as a fixed-2-decimal string so the numeric(14,2) column
//    keeps an exact value with no binary-float artifact.
//  - NQTY/NQTY2/NPACK/NPCS are N counts; dbf.mjs decodes them to numbers (null
//    when blank). qty coalesces to 0; the optional counts stay null.
//  - CPOID -> po(id) and CITEMID -> items(id) are foreign keys. If a referenced
//    header or item was not migrated, we null that FK rather than fail the import
//    (the line is preserved for any later backfill).
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { readDbf } from "./dbf.mjs";

const DBF = path.resolve("incoming/fastrak/fastrak/DATA/podet.dbf");
const clean = (v) => (typeof v === "string" ? v.trim() || null : v);
const count = (v) => (v == null ? 0 : Math.trunc(v));
const optCount = (v) => (v == null ? null : Math.trunc(v));
// Y currency decoded to a number -> exact 2-decimal string for numeric(14,2).
const money = (v) => (v == null ? null : Number(v).toFixed(2));

const { records } = readDbf(DBF);
const db = await PGlite.create("./.pglite");

// Resolve which po/item ids actually exist, so we can null dangling FKs.
const poRows = await db.query("select id from po");
const poIds = new Set(poRows.rows.map((row) => row.id));
const itemRows = await db.query("select id from items");
const itemIds = new Set(itemRows.rows.map((row) => row.id));
const fk = (id, set) => (id && set.has(id) ? id : null);

let n = 0;
let dangling = 0;
for (const r of records) {
  const id = clean(r.CID);
  if (!id) continue;

  const poId = clean(r.CPOID);
  const itemId = clean(r.CITEMID);
  const resolvedPo = fk(poId, poIds);
  const resolvedItem = fk(itemId, itemIds);
  if ((poId && !resolvedPo) || (itemId && !resolvedItem)) dangling++;

  await db.query(
    `insert into podet
       (id, tenant_id, po_id, item_id, description, code, base_cost, qty, unit,
        pack_size, unit2, qty2, pcs, updated_at)
     values ($1,'fastrak',$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12, now())
     on conflict (id) do update set
       po_id=excluded.po_id, item_id=excluded.item_id,
       description=excluded.description, code=excluded.code,
       base_cost=excluded.base_cost, qty=excluded.qty, unit=excluded.unit,
       pack_size=excluded.pack_size, unit2=excluded.unit2, qty2=excluded.qty2,
       pcs=excluded.pcs, updated_at=now()`,
    [
      id,
      resolvedPo,
      resolvedItem,
      clean(r.CDESC),
      clean(r.CCODE),
      money(r.YBASE),
      count(r.NQTY),
      clean(r.CUNIT),
      optCount(r.NPACK),
      clean(r.CUNIT2),
      optCount(r.NQTY2),
      optCount(r.NPCS)
    ]
  );
  n++;
}

await db.close();
console.log(`imported ${n} PO line(s) from ${path.basename(DBF)}`);
if (dangling) {
  console.log(`  (${dangling} line(s) had dangling po/item refs — nulled)`);
}
