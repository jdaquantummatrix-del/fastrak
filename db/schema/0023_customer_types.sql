-- Slice S1 (#18) — Customer Type as editable reference data. A lookup table
-- mirroring the Category/Brand/Unit pattern, so a customer's Type is picked from
-- a managed list instead of being free text. Pre-seeded Wholesale / Retail /
-- Distributor (matching fastrak's conventional customer classifications).
CREATE TABLE IF NOT EXISTS customer_types (
  id          text PRIMARY KEY,             -- 10-char id, same shape as fastrak CID keys (ADR-0002)
  tenant_id   text NOT NULL DEFAULT 'fastrak',
  name        varchar(50),                  -- the type label (Wholesale, Retail, ...)
  remarks     text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS customer_types_tenant_idx ON customer_types (tenant_id);

-- Name must be unique per tenant (case-insensitive) — two types can't share a name.
CREATE UNIQUE INDEX IF NOT EXISTS customer_types_name_idx
  ON customer_types (tenant_id, lower(name));

-- Pre-seed the three conventional types. Idempotent: stable ids + ON CONFLICT,
-- so re-running the schema (migrate / test-db) never duplicates them.
INSERT INTO customer_types (id, tenant_id, name) VALUES
  ('CTWHOLESAL', 'fastrak', 'Wholesale'),
  ('CTRETAIL00', 'fastrak', 'Retail'),
  ('CTDISTRIB0', 'fastrak', 'Distributor')
ON CONFLICT (id) DO NOTHING;
