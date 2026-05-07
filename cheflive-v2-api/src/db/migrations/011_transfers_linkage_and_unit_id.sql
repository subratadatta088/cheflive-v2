PRAGMA foreign_keys = ON;

-- Upgrade transfers/transfer_items to support richer linking
-- Existing baseline tables were created in 001_init.sql.

ALTER TABLE transfers ADD COLUMN from_purchase_id INTEGER;
ALTER TABLE transfers ADD COLUMN to_utilisation_id INTEGER;
ALTER TABLE transfers ADD COLUMN transfer_date TEXT;

ALTER TABLE transfer_items ADD COLUMN unit_id INTEGER;

-- Recommended indexes
CREATE INDEX IF NOT EXISTS idx_transfers_from_origin ON transfers(from_origin_id);
CREATE INDEX IF NOT EXISTS idx_transfers_to_origin ON transfers(to_origin_id);
CREATE INDEX IF NOT EXISTS idx_transfers_date ON transfers(transfer_date);
CREATE INDEX IF NOT EXISTS idx_transfer_items_transfer ON transfer_items(transfer_id);
CREATE INDEX IF NOT EXISTS idx_transfer_items_ingredient ON transfer_items(ingredient_id);

