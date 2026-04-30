PRAGMA foreign_keys = OFF;

-- ORGANIZATIONS (ensure audit columns exist)
ALTER TABLE organizations RENAME TO organizations_old;
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
INSERT INTO organizations (id, name)
SELECT id, name
FROM organizations_old;
DROP TABLE organizations_old;

-- USERS (allow organization_id NULL for superadmin, ensure audit columns exist)
ALTER TABLE users RENAME TO users_old;
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
INSERT INTO users (id, organization_id, username, password, name)
SELECT id, organization_id, username, password, name
FROM users_old;
DROP TABLE users_old;

-- USER_ROLES (allow organization_id NULL for superadmin assignment)
ALTER TABLE user_roles RENAME TO user_roles_old;
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
INSERT INTO user_roles (id, organization_id, user_id, role_id)
SELECT id, organization_id, user_id, role_id
FROM user_roles_old;
DROP TABLE user_roles_old;

PRAGMA foreign_keys = ON;

