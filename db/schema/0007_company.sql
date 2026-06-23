-- Slice S10 — Company (mirrors fastrak company.dbf): the business's own info,
-- used for document/report headers. One row per tenant. See CONTEXT.md and
-- docs/analysis/fastrak-overview.md for the field mapping.
CREATE TABLE IF NOT EXISTS company (
  id          text PRIMARY KEY,             -- fastrak CID (10-char)
  tenant_id   text NOT NULL DEFAULT 'fastrak',
  name        varchar(150),                 -- CCOMPANY
  address     varchar(200),                 -- CADDRESS
  proprietor  varchar(100),                 -- CPROP
  tin         varchar(25),                  -- CTIN
  tel_no      varchar(50),                  -- CTEL
  fax_no      varchar(50),                  -- CFAX
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS company_tenant_idx ON company (tenant_id);
