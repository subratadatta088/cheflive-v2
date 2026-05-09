CREATE TABLE IF NOT EXISTS running_stock (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  organization_id INTEGER NOT NULL,
  origin_id INTEGER NOT NULL,
  ingredient_id INTEGER NOT NULL,
  qty REAL NOT NULL DEFAULT 0,
  unit TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  UNIQUE (organization_id, origin_id, ingredient_id)
);

CREATE INDEX IF NOT EXISTS idx_running_stock_org_origin
  ON running_stock (organization_id, origin_id);
CREATE INDEX IF NOT EXISTS idx_running_stock_org_ingredient
  ON running_stock (organization_id, ingredient_id);

CREATE TABLE IF NOT EXISTS stock_transition_states (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  organization_id INTEGER NOT NULL,
  origin_id INTEGER NOT NULL,
  ingredient_id INTEGER NOT NULL,
  unit TEXT NOT NULL,
  qty_before REAL NOT NULL,
  qty_delta REAL NOT NULL,
  qty_after REAL NOT NULL,
  source_type TEXT NOT NULL,
  source_transfer_id INTEGER,
  source_transfer_item_id INTEGER,
  occurred_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  created_by INTEGER,
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_sts_org_origin_ing
  ON stock_transition_states (organization_id, origin_id, ingredient_id);
CREATE INDEX IF NOT EXISTS idx_sts_source_transfer
  ON stock_transition_states (source_transfer_id);
CREATE INDEX IF NOT EXISTS idx_sts_org_occurred
  ON stock_transition_states (organization_id, occurred_at);
