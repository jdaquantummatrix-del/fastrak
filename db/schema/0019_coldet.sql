-- Slice S7 — Collection detail line (mirrors fastrak coldet.dbf). One application of
-- a customer's payment against a single outstanding A/R row, under a col header
-- (0018_col.sql). See issue #13.
--
-- col_id is a real FK to col(id) — the parent collection. ar_id is a real FK to
-- ar(id) — the receivable this line pays down. customer_id is a real FK to
-- customers(id) (fastrak's per-line CCUSTID, who owes the settled A/R). The line
-- snapshots the A/R's DR number (CDRNO) and due date (DDUE) at collection time, plus
-- the receivable date (DDATE), so the collection prints the same way the FoxPro form
-- does even if the source A/R later changes.
--
-- YAMOUNT is the amount applied to THIS A/R row (fastrak Y-currency 8-byte int / 10000
-- -> numeric(14,2)): Postgres returns it as an exact decimal string, so the collected
-- total (sum of the lines) and the A/R reduction never drift (ADR-0001 fidelity).
-- Recording the collection reduces ar.amount by this value (lib/collections.ts), so it
-- is the load-bearing figure here.
CREATE TABLE IF NOT EXISTS coldet (
  id            text PRIMARY KEY,                 -- fastrak CID (10-char)
  tenant_id     text NOT NULL DEFAULT 'fastrak',
  col_id        text REFERENCES col(id),          -- CCOLID  (parent collection header)
  customer_id   text REFERENCES customers(id),    -- CCUSTID (who owes the settled A/R)
  ar_id         text REFERENCES ar(id),           -- CARID   (the receivable being paid)
  dr_no         varchar(25),                      -- CDRNO   (snapshot of the A/R's DR no.)
  due_date      date,                             -- DDUE    (snapshot of the A/R due date)
  ar_date       date,                             -- DDATE   (the receivable date)
  amount        numeric(14,2) NOT NULL DEFAULT 0, -- YAMOUNT (amount applied to this A/R)
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS coldet_tenant_idx ON coldet (tenant_id);
CREATE INDEX IF NOT EXISTS coldet_col_idx ON coldet (col_id);
CREATE INDEX IF NOT EXISTS coldet_ar_idx ON coldet (ar_id);
CREATE INDEX IF NOT EXISTS coldet_customer_idx ON coldet (customer_id);
