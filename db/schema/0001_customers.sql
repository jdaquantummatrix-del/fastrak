-- Slice S2 — Customer (mirrors fastrak customer.dbf). See docs/analysis/fastrak-overview.md.
CREATE TABLE IF NOT EXISTS customers (
  id              text PRIMARY KEY,             -- fastrak CID (10-char)
  tenant_id       text NOT NULL DEFAULT 'fastrak',
  name            varchar(150),                 -- CNAME
  terms_days      integer,                      -- NTERMS
  address         varchar(150),                 -- CADDRESS
  contact_person  varchar(100),                 -- CCONTACT
  mobile          varchar(15),                  -- CMOBILE
  tel_no          varchar(25),                  -- CTELNO
  fax_no          varchar(15),                  -- CFAXNO
  tin             varchar(25),                  -- CTIN
  type            varchar(9),                   -- CTYPE
  remarks         text,                         -- CREMARKS
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS customers_tenant_idx ON customers (tenant_id);
