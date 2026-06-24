-- Slice S8 (#25) — Demo data registry. A loadable + wipeable demo dataset is built
-- by calling the REAL lib create/post functions (createItem, createPO/receivePO,
-- createDR/postDR, recordCollection, createReturn/postReturn, ...), so it exercises
-- the same money/stock/A-R machinery as real data. The catch: once built, demo rows
-- are indistinguishable from real rows (both carry tenant_id 'fastrak'), so a blind
-- wipe could delete a client's real data.
--
-- This table is the separator. Every row the loader creates is RECORDED here as
-- (table_name, row_id). The wipe command deletes exactly the recorded rows — in
-- FK-safe order — and nothing else, then clears the registry. Real data, never
-- registered, is never touched.
CREATE TABLE IF NOT EXISTS demo_data (
  id          text PRIMARY KEY,             -- 10-char id, same shape as fastrak CID keys (ADR-0002)
  tenant_id   text NOT NULL DEFAULT 'fastrak',
  table_name  text NOT NULL,                -- the table the demo row lives in (e.g. 'items', 'dr')
  row_id      text NOT NULL,                -- the demo row's primary key in that table
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS demo_data_tenant_idx ON demo_data (tenant_id);

-- A demo row is recorded at most once (idempotent re-registration is a no-op).
CREATE UNIQUE INDEX IF NOT EXISTS demo_data_row_idx
  ON demo_data (table_name, row_id);
