-- Slice S3 — Item (mirrors fastrak item.dbf). The product catalog.
-- See docs/analysis/fastrak-overview.md and issue #7.
-- Money (YBASE/YPRICE/YRETAIL) is fastrak Y-currency (8-byte int / 10000),
-- stored here as numeric(14,2) so there is no float drift (ADR-0001 fidelity).
-- CUNIT/CUNIT2 hold the unit *text* (e.g. "BOX", "PCS"), not a unit id.
-- CCATEGID/CBRANDID/CSUPPID are 10-char foreign keys to the reference tables.
CREATE TABLE IF NOT EXISTS items (
  id            text PRIMARY KEY,             -- fastrak CID (10-char)
  tenant_id     text NOT NULL DEFAULT 'fastrak',
  code          varchar(100),                 -- CCODE
  description   varchar(150),                 -- CDESC
  unit          varchar(10),                  -- CUNIT  (text value, e.g. "BOX")
  unit2         varchar(10),                  -- CUNIT2 (alternate unit text)
  pack_size     integer,                      -- NPACK  (pcs per pack)
  base_cost     numeric(14,2),                -- YBASE  (cost)
  price         numeric(14,2),                -- YPRICE (selling price)
  retail        numeric(14,2),                -- YRETAIL
  category_id   text REFERENCES categories(id), -- CCATEGID
  brand_id      text REFERENCES brands(id),     -- CBRANDID
  supplier_id   text REFERENCES suppliers(id),  -- CSUPPID
  inactive      boolean,                      -- LINACTIVE
  critical      integer,                      -- NCRITICAL (reorder threshold)
  pic           varchar(250),                 -- CPIC (image path/filename)
  type          varchar(6),                   -- CTYPE (Import / Local)
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS items_tenant_idx ON items (tenant_id);
CREATE INDEX IF NOT EXISTS items_category_idx ON items (category_id);
CREATE INDEX IF NOT EXISTS items_brand_idx ON items (brand_id);
CREATE INDEX IF NOT EXISTS items_supplier_idx ON items (supplier_id);
