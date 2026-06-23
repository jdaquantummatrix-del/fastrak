-- Slice S8 — Return detail line (mirrors fastrak returndet.dbf). One returned-item
-- line under a return header (0016_return.sql). See issue #12.
--
-- return_id is a real FK to return(id) — the parent header; item_id a real FK to
-- items(id). YPRICE/YBASE are fastrak Y-currency (8-byte int / 10000) -> numeric(14,2)
-- so there is no float drift (ADR-0001 fidelity). NDISC/NDISC2 are per-line discount
-- *percentages* — the return value of a line is computed the same way a DR line's net
-- is (round(price * qty * ((100-disc)/100) * ((100-disc2)/100), 2)); see lib/returns.ts.
--
-- Unlike a DR line, a return line carries no NQTY2/NPACK: fastrak's return posting
-- moves stock by NQTY directly (the quantity is already in the line's unit). LGOOD is
-- the load-bearing flag here: only LGOOD lines are restocked on post (damaged returns
-- stay out of inventory). A line snapshots the item's code/description at return time.
CREATE TABLE IF NOT EXISTS returndet (
  id            text PRIMARY KEY,                 -- fastrak CID (10-char)
  tenant_id     text NOT NULL DEFAULT 'fastrak',
  return_id     text REFERENCES return(id),       -- CRETID  (parent header)
  item_id       text REFERENCES items(id),        -- CITEMID (returned item)
  qty           integer NOT NULL DEFAULT 0,       -- NQTY    (qty returned, in CUNIT)
  unit          varchar(10),                      -- CUNIT
  price         numeric(14,2),                    -- YPRICE  (unit selling price)
  base_cost     numeric(14,2),                    -- YBASE   (unit cost)
  description   varchar(200),                     -- CDESC   (snapshot of item desc)
  code          varchar(100),                     -- CCODE   (snapshot of item code)
  disc          numeric(10,2) NOT NULL DEFAULT 0, -- NDISC   (line discount %)
  disc2         numeric(10,2) NOT NULL DEFAULT 0, -- NDISC2  (second line discount %)
  good          boolean,                          -- LGOOD   (resalable -> restocked on post)
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS returndet_tenant_idx ON returndet (tenant_id);
CREATE INDEX IF NOT EXISTS returndet_return_idx ON returndet (return_id);
CREATE INDEX IF NOT EXISTS returndet_item_idx ON returndet (item_id);
