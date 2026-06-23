-- Slice S1 — Unit (mirrors fastrak unit.dbf). Reference/lookup table for items.
-- See docs/analysis/fastrak-overview.md.
CREATE TABLE IF NOT EXISTS units (
  id          text PRIMARY KEY,             -- fastrak CID (10-char)
  tenant_id   text NOT NULL DEFAULT 'fastrak',
  unit        varchar(10),                  -- CUNIT
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS units_tenant_idx ON units (tenant_id);
