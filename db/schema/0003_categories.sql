-- Slice S1 — Category (mirrors fastrak category.dbf). Reference/lookup table for items.
-- See docs/analysis/fastrak-overview.md.
CREATE TABLE IF NOT EXISTS categories (
  id          text PRIMARY KEY,             -- fastrak CID (10-char)
  tenant_id   text NOT NULL DEFAULT 'fastrak',
  category    varchar(150),                 -- CCATEGORY
  remarks     text,                         -- CREMARKS
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS categories_tenant_idx ON categories (tenant_id);
