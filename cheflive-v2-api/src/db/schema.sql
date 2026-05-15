-- Core tables for ChefLive v2 (SQLite)
-- Notes:
-- - Store timestamps as ISO8601 TEXT in UTC (e.g. 2026-04-28T12:34:56.789Z)
-- - JSON fields are stored as TEXT; app layer can JSON.stringify/parse.

PRAGMA foreign_keys = ON;

-- ORGANIZATIONS
CREATE TABLE IF NOT EXISTS organizations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,

  created_by INTEGER,
  updated_by INTEGER,
  created_at TEXT,
  updated_at TEXT,
  deleted_at TEXT,
  deleted_by INTEGER
);

-- USERS
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  organization_id INTEGER,

  username TEXT NOT NULL,
  password TEXT NOT NULL,
  name TEXT,

  created_by INTEGER,
  updated_by INTEGER,
  created_at TEXT,
  updated_at TEXT,
  deleted_at TEXT,
  deleted_by INTEGER,

  UNIQUE (organization_id, username)
);

-- ROLES
CREATE TABLE IF NOT EXISTS roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,

  created_by INTEGER,
  updated_by INTEGER,
  created_at TEXT,
  updated_at TEXT,
  deleted_at TEXT,
  deleted_by INTEGER
);

-- USER ROLES (many-to-many)
CREATE TABLE IF NOT EXISTS user_roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  organization_id INTEGER,

  user_id INTEGER NOT NULL,
  role_id INTEGER NOT NULL,

  created_by INTEGER,
  created_at TEXT,
  deleted_at TEXT,
  deleted_by INTEGER,

  UNIQUE (user_id, role_id)
);

-- INGREDIENTS
CREATE TABLE IF NOT EXISTS ingredients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  organization_id INTEGER NOT NULL,

  category_id INTEGER NOT NULL,

  item_code INTEGER, -- barcode (optional, numeric)

  name TEXT NOT NULL,
  unit TEXT NOT NULL,

  base_price REAL,
  tags TEXT, -- JSON array

  is_active INTEGER DEFAULT 1,

  created_by INTEGER,
  updated_by INTEGER,
  created_at TEXT,
  updated_at TEXT,
  deleted_at TEXT,
  deleted_by INTEGER
);

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

-- INGREDIENT TAGS
CREATE TABLE IF NOT EXISTS ingredient_tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  organization_id INTEGER NOT NULL,

  name TEXT UNIQUE,

  created_by INTEGER,
  updated_by INTEGER,
  created_at TEXT,
  updated_at TEXT,
  deleted_at TEXT,
  deleted_by INTEGER
);

-- PREPARATIONS
CREATE TABLE IF NOT EXISTS preparations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  organization_id INTEGER NOT NULL,

  name TEXT NOT NULL,
  type TEXT,

  qty REAL,
  unit TEXT,

  tags TEXT, -- JSON

  is_active INTEGER DEFAULT 1,

  created_by INTEGER,
  updated_by INTEGER,
  created_at TEXT,
  updated_at TEXT,
  deleted_at TEXT,
  deleted_by INTEGER
);

-- PREPARATION ITEMS
CREATE TABLE IF NOT EXISTS preparation_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  organization_id INTEGER NOT NULL,

  preparation_id INTEGER,
  ingredient_id INTEGER,

  qty REAL,
  unit TEXT,

  created_by INTEGER,
  updated_by INTEGER,
  created_at TEXT,
  updated_at TEXT,
  deleted_at TEXT,
  deleted_by INTEGER
);

-- ORIGINS
CREATE TABLE IF NOT EXISTS origins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  organization_id INTEGER NOT NULL,

  name TEXT NOT NULL,
  type TEXT NOT NULL,

  is_active INTEGER DEFAULT 1,
  is_default INTEGER DEFAULT 0,

  created_by INTEGER,
  updated_by INTEGER,
  created_at TEXT,
  updated_at TEXT,
  deleted_at TEXT,
  deleted_by INTEGER
);

-- TRANSFERS
CREATE TABLE IF NOT EXISTS transfers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  organization_id INTEGER NOT NULL,

  from_origin_id INTEGER,
  to_origin_id INTEGER,

  date TEXT NOT NULL,
  note TEXT,

  created_by INTEGER,
  updated_by INTEGER,
  created_at TEXT,
  updated_at TEXT,
  deleted_at TEXT,
  deleted_by INTEGER
);

-- TRANSFER ITEMS
CREATE TABLE IF NOT EXISTS transfer_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  organization_id INTEGER NOT NULL,

  transfer_id INTEGER,
  ingredient_id INTEGER,

  qty REAL NOT NULL,
  unit TEXT,

  created_by INTEGER,
  updated_by INTEGER,
  created_at TEXT,
  updated_at TEXT,
  deleted_at TEXT,
  deleted_by INTEGER
);

-- MENUS
CREATE TABLE IF NOT EXISTS menus (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  organization_id INTEGER NOT NULL,

  name TEXT NOT NULL,
  type TEXT,

  tags TEXT, -- JSON

  is_active INTEGER DEFAULT 1,

  created_by INTEGER,
  updated_by INTEGER,
  created_at TEXT,
  updated_at TEXT,
  deleted_at TEXT,
  deleted_by INTEGER
);

-- MENU ITEMS
CREATE TABLE IF NOT EXISTS menu_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  organization_id INTEGER NOT NULL,

  menu_id INTEGER,
  ingredient_id INTEGER,

  created_by INTEGER,
  updated_by INTEGER,
  created_at TEXT,
  updated_at TEXT,
  deleted_at TEXT,
  deleted_by INTEGER
);

-- MENU TAGS
CREATE TABLE IF NOT EXISTS menu_tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  organization_id INTEGER NOT NULL,

  name TEXT UNIQUE,

  created_by INTEGER,
  updated_by INTEGER,
  created_at TEXT,
  updated_at TEXT,
  deleted_at TEXT,
  deleted_by INTEGER
);

-- UTILIZATIONS
CREATE TABLE IF NOT EXISTS utilizations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  organization_id INTEGER NOT NULL,

  origin_id INTEGER,

  type TEXT,
  preparation_id INTEGER,
  menu_id INTEGER,

  qty REAL,
  unit TEXT,

  date TEXT,
  note TEXT,

  created_by INTEGER,
  updated_by INTEGER,
  created_at TEXT,
  updated_at TEXT,
  deleted_at TEXT,
  deleted_by INTEGER
);

-- UTILIZATION ITEMS
CREATE TABLE IF NOT EXISTS utilization_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  organization_id INTEGER NOT NULL,

  utilization_id INTEGER,
  ingredient_id INTEGER,

  unit TEXT,
  qty REAL,

  created_by INTEGER,
  updated_by INTEGER,
  created_at TEXT,
  updated_at TEXT,
  deleted_at TEXT,
  deleted_by INTEGER
);

-- UNIT CONVERSIONS
CREATE TABLE IF NOT EXISTS ingredient_unit_conversions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  organization_id INTEGER NOT NULL,

  ingredient_id INTEGER,

  from_unit TEXT,
  to_unit TEXT,

  factor REAL,

  created_by INTEGER,
  updated_by INTEGER,
  created_at TEXT,
  updated_at TEXT,
  deleted_at TEXT,
  deleted_by INTEGER
);

-- PURCHASES
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

-- Optional helpful indexes (safe for SQLite now; equivalents exist in MySQL/Postgres)
CREATE INDEX IF NOT EXISTS idx_users_org ON users (organization_id);
CREATE INDEX IF NOT EXISTS idx_users_org_username ON users (organization_id, username);
CREATE INDEX IF NOT EXISTS idx_roles_name ON roles (name);
CREATE INDEX IF NOT EXISTS idx_user_roles_org ON user_roles (organization_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON user_roles (user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles (role_id);
CREATE INDEX IF NOT EXISTS idx_ingredients_org ON ingredients (organization_id);
CREATE INDEX IF NOT EXISTS idx_ingredients_org_created_by ON ingredients (organization_id, created_by);
CREATE UNIQUE INDEX IF NOT EXISTS uq_ingredients_org_item_code
  ON ingredients (organization_id, item_code)
  WHERE item_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ingredient_tags_org ON ingredient_tags (organization_id);
CREATE INDEX IF NOT EXISTS idx_ingredient_tags_org_created_by ON ingredient_tags (organization_id, created_by);
CREATE INDEX IF NOT EXISTS idx_preparations_org ON preparations (organization_id);
CREATE INDEX IF NOT EXISTS idx_preparations_org_created_by ON preparations (organization_id, created_by);
CREATE INDEX IF NOT EXISTS idx_preparation_items_org ON preparation_items (organization_id);
CREATE INDEX IF NOT EXISTS idx_preparation_items_prep ON preparation_items (preparation_id);
CREATE INDEX IF NOT EXISTS idx_preparation_items_org_created_by ON preparation_items (organization_id, created_by);
CREATE INDEX IF NOT EXISTS idx_origins_org ON origins (organization_id);
CREATE INDEX IF NOT EXISTS idx_origins_org_created_by ON origins (organization_id, created_by);
CREATE INDEX IF NOT EXISTS idx_transfers_org ON transfers (organization_id);
CREATE INDEX IF NOT EXISTS idx_transfers_org_created_by ON transfers (organization_id, created_by);
CREATE INDEX IF NOT EXISTS idx_transfer_items_org ON transfer_items (organization_id);
CREATE INDEX IF NOT EXISTS idx_transfer_items_transfer ON transfer_items (transfer_id);
CREATE INDEX IF NOT EXISTS idx_transfer_items_org_created_by ON transfer_items (organization_id, created_by);
CREATE INDEX IF NOT EXISTS idx_menus_org ON menus (organization_id);
CREATE INDEX IF NOT EXISTS idx_menus_org_created_by ON menus (organization_id, created_by);
CREATE INDEX IF NOT EXISTS idx_menu_items_org ON menu_items (organization_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_menu ON menu_items (menu_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_org_created_by ON menu_items (organization_id, created_by);
CREATE INDEX IF NOT EXISTS idx_menu_tags_org ON menu_tags (organization_id);
CREATE INDEX IF NOT EXISTS idx_menu_tags_org_created_by ON menu_tags (organization_id, created_by);
CREATE INDEX IF NOT EXISTS idx_utilizations_org ON utilizations (organization_id);
CREATE INDEX IF NOT EXISTS idx_utilizations_org_created_by ON utilizations (organization_id, created_by);
CREATE INDEX IF NOT EXISTS idx_utilization_items_org ON utilization_items (organization_id);
CREATE INDEX IF NOT EXISTS idx_utilization_items_utilization ON utilization_items (utilization_id);
CREATE INDEX IF NOT EXISTS idx_utilization_items_org_created_by ON utilization_items (organization_id, created_by);
CREATE INDEX IF NOT EXISTS idx_conversions_org ON ingredient_unit_conversions (organization_id);
CREATE INDEX IF NOT EXISTS idx_conversions_ingredient ON ingredient_unit_conversions (ingredient_id);
CREATE INDEX IF NOT EXISTS idx_conversions_org_created_by ON ingredient_unit_conversions (organization_id, created_by);
CREATE INDEX IF NOT EXISTS idx_purchases_org ON purchases (organization_id);
CREATE INDEX IF NOT EXISTS idx_purchases_org_date ON purchases (organization_id, date);
CREATE INDEX IF NOT EXISTS idx_purchase_items_org ON purchase_items (organization_id);
CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase ON purchase_items (purchase_id);
CREATE INDEX IF NOT EXISTS idx_purchase_items_ingredient ON purchase_items (ingredient_id);

-- SEEDS (safe to re-run)
INSERT OR IGNORE INTO roles (name, created_at, updated_at)
VALUES ('superadmin', strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now'));
INSERT OR IGNORE INTO roles (name, created_at, updated_at)
VALUES ('admin', strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now'));
INSERT OR IGNORE INTO roles (name, created_at, updated_at)
VALUES ('member', strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now'));
