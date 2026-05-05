PRAGMA foreign_keys = OFF;

-- CATEGORIES
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  organization_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  is_active INTEGER DEFAULT 1,
  created_by INTEGER,
  updated_by INTEGER,
  created_at TEXT,
  updated_at TEXT,
  deleted_at TEXT,
  deleted_by INTEGER,
  UNIQUE (organization_id, name)
);

-- Add column (nullable first for backfill)
ALTER TABLE ingredients ADD COLUMN category_id INTEGER;

-- Create a default category per organization and backfill existing ingredients
INSERT OR IGNORE INTO categories (organization_id, name, is_active, created_at, updated_at)
SELECT organization_id, 'Uncategorized', 1, datetime('now'), datetime('now')
FROM ingredients
WHERE organization_id IS NOT NULL
GROUP BY organization_id;

UPDATE ingredients
SET category_id = (
  SELECT c.id
  FROM categories c
  WHERE c.organization_id = ingredients.organization_id
    AND c.name = 'Uncategorized'
  LIMIT 1
)
WHERE category_id IS NULL;

-- Rebuild ingredients table with NOT NULL category_id
ALTER TABLE ingredients RENAME TO ingredients_old;

CREATE TABLE IF NOT EXISTS ingredients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  organization_id INTEGER NOT NULL,
  category_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  unit TEXT NOT NULL,
  base_price REAL,
  tags TEXT,
  is_active INTEGER DEFAULT 1,
  created_by INTEGER,
  updated_by INTEGER,
  created_at TEXT,
  updated_at TEXT,
  deleted_at TEXT,
  deleted_by INTEGER
);

-- Some older DBs may not have audit columns like created_by/updated_by/deleted_by.
-- Backfill those as NULL during rebuild for compatibility.
INSERT INTO ingredients (id, organization_id, category_id, name, unit, base_price, tags, is_active, created_by, updated_by, created_at, updated_at, deleted_at, deleted_by)
SELECT id, organization_id, category_id, name, unit, base_price, tags, is_active, NULL, NULL, created_at, updated_at, deleted_at, NULL
FROM ingredients_old;

DROP TABLE ingredients_old;

CREATE INDEX IF NOT EXISTS idx_categories_org ON categories (organization_id);
CREATE INDEX IF NOT EXISTS idx_ingredients_org ON ingredients (organization_id);

PRAGMA foreign_keys = ON;

