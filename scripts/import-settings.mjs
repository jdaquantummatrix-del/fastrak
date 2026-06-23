// Import fastrak's appdflt.dbf (application defaults) into the local dev
// database (PGlite). Field mapping: db/schema/0008_app_settings.sql. Preserves
// legacy CIDs (8-char here, ADR-0002). Note: MMESSAGE is a memo field, which the
// dependency-free reader returns as null — the memo body is not migrated.
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { readDbf } from "./dbf.mjs";

const DBF = path.resolve("incoming/fastrak/fastrak/DATA/appdflt.dbf");
const clean = (v) => (typeof v === "string" ? v.trim() || null : v);

const { records } = readDbf(DBF);
const db = await PGlite.create("./.pglite");

let n = 0;
for (const r of records) {
  const id = clean(r.CID);
  if (!id) continue;
  await db.query(
    `insert into app_settings
       (id, tenant_id, application, value, input_mask, format, control_width,
        data_type, message, updated_at)
     values ($1, 'fastrak', $2, $3, $4, $5, $6, $7, $8, now())
     on conflict (id) do update set
       application=excluded.application, value=excluded.value,
       input_mask=excluded.input_mask, format=excluded.format,
       control_width=excluded.control_width, data_type=excluded.data_type,
       message=excluded.message, updated_at=now()`,
    [
      id,
      clean(r.CAPPLICATI),
      clean(r.CVALUE),
      clean(r.CINPUTMASK),
      clean(r.CFORMAT),
      r.NCONTROLWI ?? null,
      clean(r.CDATATYPE),
      clean(r.MMESSAGE)
    ]
  );
  n++;
}

await db.close();
console.log(`imported ${n} setting(s) from ${path.basename(DBF)}`);
