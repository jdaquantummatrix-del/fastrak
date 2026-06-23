-- Slice S1 — Brand (mirrors fastrak brand.dbf). Reference/lookup table for items.
-- See docs/analysis/fastrak-overview.md.
CREATE TABLE IF NOT EXISTS brands (
  id          text PRIMARY KEY,             -- fastrak CID (10-char)
  tenant_id   text NOT NULL DEFAULT 'fastrak',
  brand       varchar(150),                 -- CBRAND
  remarks     text,                         -- CREMARKS
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS brands_tenant_idx ON brands (tenant_id);
