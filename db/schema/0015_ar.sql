-- Slice S6 — Accounts Receivable (mirrors fastrak ar.dbf). What a customer owes,
-- one row per posted Delivery Receipt (or Return). See issue #11 and
-- docs/analysis/fastrak-overview.md.
--
-- An A/R entry is RAISED when a DR is posted (lib/dr.ts postDR): fastrak's getpostar
-- inserts the DR grand total as the A/R amount and sets the due date from the DR's
-- payment terms (DDUE = DDATE + NTERMS days). Cancelling/unposting the DR removes the
-- A/R row in the same transaction, so receivables never drift from posted DRs.
--
-- customer_id is a real FK to customers(id); dr_id a real FK to dr(id) — the posted
-- document that created the receivable. return_id (CRETID) is the legacy link to a
-- credit-note/return document (that entity is a later slice, so it is a plain text
-- column here, not yet a FK). YAMOUNT is fastrak Y-currency (8-byte int / 10000) ->
-- numeric(14,2): Postgres returns it as an exact decimal string, so the balance math
-- has no float drift (ADR-0001 fidelity). amount is the DR grand total fastrak posts.
CREATE TABLE IF NOT EXISTS ar (
  id            text PRIMARY KEY,                 -- fastrak CID (10-char)
  tenant_id     text NOT NULL DEFAULT 'fastrak',
  customer_id   text REFERENCES customers(id),    -- CCUSTID (who owes)
  dr_no         varchar(20),                      -- CDRNO   (human DR/SI number)
  po_no         varchar(20),                      -- CPONO   (customer's PO number)
  ar_date       date,                             -- DDATE   (receivable date = DR date)
  due_date      date,                             -- DDUE    (DR date + terms days)
  amount        numeric(14,2) NOT NULL DEFAULT 0, -- YAMOUNT (DR grand total owed)
  remarks       varchar(150),                     -- CREMARKS
  dr_id         text REFERENCES dr(id),           -- CDRID   (source posted DR)
  return_id     text,                             -- CRETID  (source return, later slice)
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ar_tenant_idx ON ar (tenant_id);
CREATE INDEX IF NOT EXISTS ar_customer_idx ON ar (customer_id);
CREATE INDEX IF NOT EXISTS ar_dr_idx ON ar (dr_id);
