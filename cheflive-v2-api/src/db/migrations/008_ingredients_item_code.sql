PRAGMA foreign_keys = OFF;

-- Add optional barcode / item_code (numeric)
ALTER TABLE ingredients ADD COLUMN item_code INTEGER;

-- Enforce uniqueness per org when item_code is present.
-- SQLite supports partial indexes; this keeps multiple NULL item_code rows allowed.
CREATE UNIQUE INDEX IF NOT EXISTS uq_ingredients_org_item_code
  ON ingredients (organization_id, item_code)
  WHERE item_code IS NOT NULL;

PRAGMA foreign_keys = ON;

