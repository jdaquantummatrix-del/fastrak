-- Slice S4 — Inventory ledger (mirrors fastrak inventory.dbf). See issue #8 and
-- docs/analysis/fastrak-overview.md. Each row is one stock *movement* for an item:
-- NIN units received, NOUT units released, referencing the source document
-- (PO / DR / discrepancy / return). Current stock per item = sum(in) - sum(out).
--
-- item_id is a real FK to items(id) — the entity this ledger depends on (#7).
-- The source-document references (po/dr/dscrp/return) are kept as plain 10-char
-- text columns preserving the legacy CIDs (ADR-0002); their parent tables are
-- later slices, so no FK constraint is declared here yet.
-- NIN/NOUT are fastrak N(10,0) counts -> integer (whole units; no fractional qty).
CREATE TABLE IF NOT EXISTS inventory (
  id            text PRIMARY KEY,             -- fastrak CID (10-char)
  tenant_id     text NOT NULL DEFAULT 'fastrak',
  item_id       text REFERENCES items(id),    -- CITEMID (the item moved)
  cost_price_id text,                          -- CCSTSPID (cost/selling-price snapshot)
  ref_no        varchar(150),                  -- CREFNO  (human reference, e.g. PO#)
  movement_date date,                          -- DDATE   (when the movement happened)
  qty_in        integer NOT NULL DEFAULT 0,    -- NIN     (units received)
  qty_out       integer NOT NULL DEFAULT 0,    -- NOUT    (units released)
  name          varchar(150),                  -- CNAME   (movement label, e.g. "Discrepancy")
  po_id         text,                          -- CPOID   (source purchase order)
  dr_id         text,                          -- CDRID   (source delivery receipt)
  dscrp_id      text,                          -- CDSCRPID(source discrepancy)
  return_id     text,                          -- CRETID  (source return)
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS inventory_tenant_idx ON inventory (tenant_id);
CREATE INDEX IF NOT EXISTS inventory_item_idx ON inventory (item_id);
