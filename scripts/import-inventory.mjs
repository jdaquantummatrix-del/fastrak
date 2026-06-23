// Import fastrak's inventory.dbf into the local dev database (PGlite).
// Field mapping: db/schema/0009_inventory.sql. Preserves legacy CIDs (ADR-0002).
//
// Notes:
//  - NIN/NOUT are N counts; scripts/dbf.mjs decodes them to numbers (null when
//    blank). We coalesce missing counts to 0 so balances stay exact.
//  - DDATE is a D date; dbf.mjs decodes it to "YYYY-MM-DD" (or null).
//  - CITEMID is a foreign key to items(id). If the referenced item was not
//    migrated (sample data has dangling refs), we null the FK rather than fail
//    the whole import — the movement is preserved for any later backfill.
//  - CPOID/CDRID/CDSCRPID/CRETID are the source-document references; kept as
//    plain text (their parent tables are later slices).
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { readDbf } from "./dbf.mjs";

const DBF = path.resolve("incoming/fastrak/fastrak/DATA/inventory.dbf");
const clean = (v) => (typeof v === "string" ? v.trim() || null : v);
const count = (v) => (v == null ? 0 : Math.trunc(v));

const { records } = readDbf(DBF);
const db = await PGlite.create("./.pglite");

// Resolve which item ids actually exist, so we can null dangling FKs.
const itemRows = await db.query("select id from items");
const itemIds = new Set(itemRows.rows.map((row) => row.id));
const fk = (id, set) => (id && set.has(id) ? id : null);

let n = 0;
let dangling = 0;
for (const r of records) {
  const id = clean(r.CID);
  if (!id) continue;

  const itemId = clean(r.CITEMID);
  const resolvedItem = fk(itemId, itemIds);
  if (itemId && !resolvedItem) dangling++;

  await db.query(
    `insert into inventory
       (id, tenant_id, item_id, cost_price_id, ref_no, movement_date, qty_in,
        qty_out, name, po_id, dr_id, dscrp_id, return_id, updated_at)
     values ($1,'fastrak',$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12, now())
     on conflict (id) do update set
       item_id=excluded.item_id, cost_price_id=excluded.cost_price_id,
       ref_no=excluded.ref_no, movement_date=excluded.movement_date,
       qty_in=excluded.qty_in, qty_out=excluded.qty_out, name=excluded.name,
       po_id=excluded.po_id, dr_id=excluded.dr_id, dscrp_id=excluded.dscrp_id,
       return_id=excluded.return_id, updated_at=now()`,
    [
      id,
      resolvedItem,
      clean(r.CCSTSPID),
      clean(r.CREFNO),
      clean(r.DDATE),
      count(r.NIN),
      count(r.NOUT),
      clean(r.CNAME),
      clean(r.CPOID),
      clean(r.CDRID),
      clean(r.CDSCRPID),
      clean(r.CRETID)
    ]
  );
  n++;
}

await db.close();
console.log(`imported ${n} inventory movement(s) from ${path.basename(DBF)}`);
if (dangling) {
  console.log(`  (${dangling} movement(s) had dangling item refs — nulled)`);
}
