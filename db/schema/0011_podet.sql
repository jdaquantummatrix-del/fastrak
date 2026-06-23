-- Slice S9 — Purchase Order detail line (mirrors fastrak podet.dbf). One ordered
-- item line under a po header (0010_po.sql). See issue #9.
--
-- po_id is a real FK to po(id) — the parent header; item_id a real FK to items(id).
-- YBASE is fastrak Y-currency (8-byte int / 10000) -> numeric(14,2) so there is no
-- float drift (ADR-0001 fidelity). NQTY/NQTY2/NPACK/NPCS are N counts -> integer.
-- A line snapshots the item's code/description/unit at order time (legacy CDESC
-- /CCODE/CUNIT), so historic POs stay readable even if the catalog later changes.
CREATE TABLE IF NOT EXISTS podet (
  id            text PRIMARY KEY,                 -- fastrak CID (10-char)
  tenant_id     text NOT NULL DEFAULT 'fastrak',
  po_id         text REFERENCES po(id),           -- CPOID  (parent header)
  item_id       text REFERENCES items(id),        -- CITEMID (ordered item)
  description   varchar(150),                     -- CDESC  (snapshot of item desc)
  code          varchar(20),                      -- CCODE  (snapshot of item code)
  base_cost     numeric(14,2),                    -- YBASE  (unit cost ordered at)
  qty           integer NOT NULL DEFAULT 0,       -- NQTY   (qty in primary unit)
  unit          varchar(10),                      -- CUNIT  (primary unit, e.g. BOX)
  pack_size     integer,                          -- NPACK  (pcs per pack)
  unit2         varchar(10),                      -- CUNIT2 (alternate unit)
  qty2          integer,                          -- NQTY2  (qty in alternate unit)
  pcs           integer,                          -- NPCS   (loose pcs)
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS podet_tenant_idx ON podet (tenant_id);
CREATE INDEX IF NOT EXISTS podet_po_idx ON podet (po_id);
CREATE INDEX IF NOT EXISTS podet_item_idx ON podet (item_id);
