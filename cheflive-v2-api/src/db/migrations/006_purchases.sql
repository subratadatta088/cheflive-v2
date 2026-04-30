PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS purchases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  organization_id INTEGER NOT NULL,

  origin_id INTEGER NOT NULL,

  date TEXT NOT NULL,
  note TEXT,

  created_by INTEGER,
  updated_by INTEGER,
  created_at TEXT,
  updated_at TEXT,
  deleted_at TEXT,
  deleted_by INTEGER
);

CREATE TABLE IF NOT EXISTS purchase_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  organization_id INTEGER NOT NULL,

  purchase_id INTEGER NOT NULL,
  ingredient_id INTEGER NOT NULL,

  qty REAL NOT NULL,
  unit TEXT,

  unit_price REAL,

  created_by INTEGER,
  updated_by INTEGER,
  created_at TEXT,
  updated_at TEXT,
  deleted_at TEXT,
  deleted_by INTEGER
);

CREATE INDEX IF NOT EXISTS idx_purchases_org ON purchases (organization_id);
CREATE INDEX IF NOT EXISTS idx_purchases_org_date ON purchases (organization_id, date);
CREATE INDEX IF NOT EXISTS idx_purchase_items_org ON purchase_items (organization_id);
CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase ON purchase_items (purchase_id);
CREATE INDEX IF NOT EXISTS idx_purchase_items_ingredient ON purchase_items (ingredient_id);
