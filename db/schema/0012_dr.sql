-- Slice S5 — Delivery Receipt header (mirrors fastrak dr.dbf). A sale/delivery to
-- a customer; its detail lines live in drdet (0013_drdet.sql). See issue #10 and
-- docs/analysis/fastrak-overview.md. Posting a DR releases stock (one inventory OUT
-- movement per line; see lib/dr.ts postDR) and is money-critical, so the totals and
-- discount math were recovered from fastrak's source (LIBS/abizness.vct) — see the
-- header of lib/dr.ts for the exact formulas (ADR-0001 fidelity).
--
-- customer_id is a real FK to customers(id) — the entity a DR depends on (S1, #4).
-- The legacy file carries CADDRESS (a free-text ship-to address snapshot) alongside
-- the customer FK; we keep both. LPOST/LCANCEL are fastrak's status flags. NDRDISC
-- and NDRDISC2 are document-level discount *percentages* (the FoxPro form formats
-- them "999.99%"); NADD is an add-on *percentage* and YADD is the resulting add-on
-- currency fastrak stores (Y-currency 8-byte int / 10000 -> numeric(14,2)).
CREATE TABLE IF NOT EXISTS dr (
  id            text PRIMARY KEY,                 -- fastrak CID (10-char)
  tenant_id     text NOT NULL DEFAULT 'fastrak',
  dr_no         varchar(25),                      -- CDRNO   (human DR number)
  customer_id   text REFERENCES customers(id),    -- CCUSTID (who it's delivered to)
  address       varchar(200),                     -- CADDRESS (ship-to snapshot)
  dr_date       date,                             -- DDATE   (delivery date)
  remarks       varchar(150),                     -- CREMARKS
  terms_days    integer NOT NULL DEFAULT 0,       -- NTERMS  (payment terms in days)
  po_no         varchar(25),                      -- CPONO   (customer's PO number)
  doc_disc      numeric(10,2) NOT NULL DEFAULT 0, -- NDRDISC  (document discount %)
  doc_disc2     numeric(10,2) NOT NULL DEFAULT 0, -- NDRDISC2 (second document disc %, legacy/unused)
  add_pct       numeric(10,2) NOT NULL DEFAULT 0, -- NADD     (add-on charge %)
  add_amount    numeric(14,2) NOT NULL DEFAULT 0, -- YADD     (add-on amount, computed)
  type          varchar(9),                       -- CTYPE
  dr_si         varchar(3),                       -- CDRSI    (sales-invoice tag)
  posted        boolean NOT NULL DEFAULT false,   -- LPOST    (posted -> stock released, AR raised)
  cancelled     boolean NOT NULL DEFAULT false,   -- LCANCEL  (voided)
  received      boolean,                          -- LRCVDR   (customer-acknowledged receipt)
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS dr_tenant_idx ON dr (tenant_id);
CREATE INDEX IF NOT EXISTS dr_customer_idx ON dr (customer_id);
