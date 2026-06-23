-- Slice S9 — Purchase Order header (mirrors fastrak po.dbf). An order placed to a
-- supplier; its detail lines live in podet (0011_podet.sql). Receiving a PO posts
-- one inventory IN movement per line (see lib/po.ts receivePO + issue #9).
--
-- supplier_id is a real FK to suppliers(id) — the entity a PO depends on (S1, #5).
-- The legacy file carries both CSUPPLIER (a free-text supplier name, usually blank)
-- and CSUPPID (the 10-char supplier id); we keep the text as supplier_name and the
-- id as the FK. LPOST is fastrak's "posted/received" flag -> received boolean.
CREATE TABLE IF NOT EXISTS po (
  id            text PRIMARY KEY,                 -- fastrak CID (10-char)
  tenant_id     text NOT NULL DEFAULT 'fastrak',
  po_no         varchar(25),                      -- CPONO  (human PO number)
  po_date       date,                             -- DDATE  (order date)
  supplier_id   text REFERENCES suppliers(id),    -- CSUPPID (who it's ordered from)
  supplier_name varchar(150),                     -- CSUPPLIER (legacy free-text name)
  remarks       varchar(150),                     -- CREMARKS
  received      boolean NOT NULL DEFAULT false,   -- LPOST (posted/received into stock)
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS po_tenant_idx ON po (tenant_id);
CREATE INDEX IF NOT EXISTS po_supplier_idx ON po (supplier_id);
