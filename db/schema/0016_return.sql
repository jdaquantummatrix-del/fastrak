-- Slice S8 — Return header (mirrors fastrak return.dbf). Goods a customer sends
-- back; its detail lines live in returndet (0017_returndet.sql). See issue #12 and
-- docs/analysis/fastrak-overview.md.
--
-- ── What fastrak does (recovered from LIBS/abizness.vct) ────────────────────────
-- Posting a return (the return form's getpost) does TWO things, both reproduced by
-- lib/returns.ts postReturn inside one transaction:
--   1. STOCK BACK IN — for each returndet line flagged LGOOD (resalable goods only;
--      damaged/non-good lines are NOT restocked), it appends an inventory IN of NQTY
--      (refType 'return'). Un-posting deletes those movements (delete from inventory
--      where cretid = …).
--   2. A/R DOWN — the return reduces what the customer owes. fastrak records a debit
--      memo (debitdet, type 'D') against the linked A/R row and its balance formula
--      subtracts it: balance = YAMOUNT - (YDBMEMO + YCOLLECT). Our `ar` table sums a
--      single `amount` column, so we model the same effect as an OFFSETTING NEGATIVE
--      A/R row (return_id set, amount = -return value): balanceForCustomer (sum of
--      amount) falls by exactly the return value. Un-posting removes that A/R row.
--
-- customer_id is a real FK to customers(id) — who returned the goods (CCUSTID). dr_id
-- is a real FK to dr(id) — the original Delivery Receipt the goods came from (CDRID).
-- CRETAR (the A/R row the return offsets) and CRETCUST/CBONO are legacy free-text
-- links kept as-is. LPOST is fastrak's posted flag; LAPPLIED marks a return whose
-- credit has been applied to a collection.
CREATE TABLE IF NOT EXISTS return (
  id            text PRIMARY KEY,                 -- fastrak CID (10-char)
  tenant_id     text NOT NULL DEFAULT 'fastrak',
  customer_id   text REFERENCES customers(id),    -- CCUSTID  (who returned the goods)
  return_date   date,                             -- DDATE    (return date)
  remarks       varchar(150),                     -- CREMARKS
  ret_customer  varchar(10),                      -- CRETCUST (legacy customer link)
  ret_ar        varchar(10),                      -- CRETAR   (A/R row the return offsets)
  bo_no         varchar(25),                      -- CBONO    (buy-back / debit-memo no.)
  applied       boolean,                          -- LAPPLIED (credit applied to a collection)
  dr_id         text REFERENCES dr(id),           -- CDRID    (original Delivery Receipt)
  type          varchar(9),                       -- CTYPE
  posted        boolean NOT NULL DEFAULT false,   -- LPOST    (posted -> stock restocked, A/R reduced)
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS return_tenant_idx ON return (tenant_id);
CREATE INDEX IF NOT EXISTS return_customer_idx ON return (customer_id);
CREATE INDEX IF NOT EXISTS return_dr_idx ON return (dr_id);
