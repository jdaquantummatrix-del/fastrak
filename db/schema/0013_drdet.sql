-- Slice S5 — Delivery Receipt detail line (mirrors fastrak drdet.dbf). One sold
-- item line under a dr header (0012_dr.sql). See issue #10.
--
-- dr_id is a real FK to dr(id) — the parent header; item_id a real FK to items(id).
-- YPRICE/YBASE are fastrak Y-currency (8-byte int / 10000) -> numeric(14,2) so there
-- is no float drift (ADR-0001 fidelity). NDISC/NDISC2 are per-line discount
-- *percentages*. A DR line carries BOTH NQTY (qty in the primary unit, e.g. boxes)
-- and NQTY2 (the same quantity expanded to pieces = NQTY * NPACK). fastrak's money
-- math and inventory posting operate on NQTY2 (pieces) — see lib/dr.ts — so qty2 is
-- the load-bearing quantity here. A line snapshots the item's code/description/unit
-- at sale time so historic DRs stay readable even if the catalog later changes.
CREATE TABLE IF NOT EXISTS drdet (
  id            text PRIMARY KEY,                 -- fastrak CID (10-char)
  tenant_id     text NOT NULL DEFAULT 'fastrak',
  dr_id         text REFERENCES dr(id),           -- CDRID   (parent header)
  item_id       text REFERENCES items(id),        -- CITEMID (sold item)
  description   varchar(200),                     -- CDESC   (snapshot of item desc)
  code          varchar(100),                     -- CCODE   (snapshot of item code)
  price         numeric(14,2),                    -- YPRICE  (unit selling price)
  base_cost     numeric(14,2),                    -- YBASE   (unit cost at sale time)
  qty           integer NOT NULL DEFAULT 0,       -- NQTY    (qty in primary unit, e.g. boxes)
  unit          varchar(10),                      -- CUNIT   (primary unit)
  disc          numeric(10,2) NOT NULL DEFAULT 0, -- NDISC   (line discount %)
  disc2         numeric(10,2) NOT NULL DEFAULT 0, -- NDISC2  (second line discount %)
  pack_size     numeric(10,2),                    -- NPACK   (pcs per pack)
  qty2          integer NOT NULL DEFAULT 0,       -- NQTY2   (qty expanded to pieces)
  unit2         varchar(10),                      -- CUNIT2  (alternate unit)
  seq           numeric(10,1),                    -- NSEQ    (line sort order)
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS drdet_tenant_idx ON drdet (tenant_id);
CREATE INDEX IF NOT EXISTS drdet_dr_idx ON drdet (dr_id);
CREATE INDEX IF NOT EXISTS drdet_item_idx ON drdet (item_id);
