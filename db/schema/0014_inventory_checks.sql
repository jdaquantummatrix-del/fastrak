-- Slice S4 (follow-up) — integrity guards on the inventory ledger. A movement is
-- EITHER an in OR an out: quantities are never negative, and no single row carries
-- both an in and an out. Without these, currentStock = sum(qty_in) - sum(qty_out)
-- can be silently corrupted by a negative or dual-quantity row. lib/inventory.ts
-- validates the same rules in the app layer; these constraints are the last line
-- of defence at the database. (Confirmed: every imported fastrak/champion
-- inventory row already satisfies them, so adding the constraints cannot fail.)
--
-- Idempotent: only add a constraint if it is not already present, so re-applying
-- the schema (createTestDb / migrate) stays safe.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'inventory_qty_in_nonneg'
  ) THEN
    ALTER TABLE inventory
      ADD CONSTRAINT inventory_qty_in_nonneg CHECK (qty_in >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'inventory_qty_out_nonneg'
  ) THEN
    ALTER TABLE inventory
      ADD CONSTRAINT inventory_qty_out_nonneg CHECK (qty_out >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'inventory_not_in_and_out'
  ) THEN
    ALTER TABLE inventory
      ADD CONSTRAINT inventory_not_in_and_out
      CHECK (NOT (qty_in > 0 AND qty_out > 0));
  END IF;
END
$$;
