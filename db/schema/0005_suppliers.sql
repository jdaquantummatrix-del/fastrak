-- Slice S1 — Supplier (mirrors fastrak supplier.dbf). Who items are bought from.
-- See docs/analysis/fastrak-overview.md.
CREATE TABLE IF NOT EXISTS suppliers (
  id              text PRIMARY KEY,             -- fastrak CID (10-char)
  tenant_id       text NOT NULL DEFAULT 'fastrak',
  name            varchar(150),                 -- CNAME
  terms_days      integer,                      -- NTERMS (payment terms in days)
  contact_person  varchar(100),                 -- CCONTACT
  tel_no          varchar(50),                  -- CTELNO
  fax_no          varchar(50),                  -- CFAX
  address         varchar(150),                 -- CADDRESS
  is_local        boolean,                      -- LLOCAL (local vs import supplier)
  remarks         text,                         -- CREMARKS
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS suppliers_tenant_idx ON suppliers (tenant_id);
