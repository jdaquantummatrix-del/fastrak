-- Slice S7 — Collection header (mirrors fastrak col.dbf). A payment received from a
-- customer, applied against one or more of that customer's outstanding A/R entries;
-- its detail lines live in coldet (0019_coldet.sql). See issue #13 and
-- docs/analysis/fastrak-overview.md (the business flow ends … ar -> col/coldet).
--
-- ── What fastrak does (recovered) ───────────────────────────────────────────────
-- A collection is the last step of the receivables flow: the customer pays, and the
-- payment is split across the specific A/R rows it settles (coldet, one line per
-- A/R row, carrying the amount applied to that row). Recording a collection REDUCES
-- the targeted receivables — fastrak's A/R balance formula subtracts the collected
-- amount (balance = YAMOUNT - (YDBMEMO + YCOLLECT)); we reproduce the same effect by
-- reducing the targeted `ar.amount` directly (see lib/collections.ts recordCollection),
-- so balanceForCustomer (sum of amount) falls by exactly the payment.
--
-- The legacy header is thin (date + remarks + a customer link). fastrak names the
-- customer FK CCUSTID2 on the header (the per-line CCUSTID on coldet is authoritative);
-- we keep it as customer_id, a real FK to customers(id). YAMOUNT (the collection total)
-- is not stored on the legacy header — it is the sum of the coldet line amounts — so we
-- derive it on read rather than store it.
CREATE TABLE IF NOT EXISTS col (
  id            text PRIMARY KEY,                 -- fastrak CID (10-char)
  tenant_id     text NOT NULL DEFAULT 'fastrak',
  col_date      date,                             -- DDATE    (collection/payment date)
  remarks       varchar(150),                     -- CREMARKS
  customer_id   text REFERENCES customers(id),    -- CCUSTID2 (who paid)
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS col_tenant_idx ON col (tenant_id);
CREATE INDEX IF NOT EXISTS col_customer_idx ON col (customer_id);
