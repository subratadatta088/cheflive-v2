-- Some early dev databases were created without `updated_at` on
-- `transfer_items`, even though 001_init.sql defines it. Inserts/updates
-- from TransferItemSqliteDAL fail with:
--   SQLITE_ERROR: table transfer_items has no column named updated_at
--
-- This migration repairs those databases. The migration runner
-- (src/db/migrate.js) tolerates "duplicate column" errors and marks the
-- migration as applied, so this is a no-op on databases that already have
-- the column.

ALTER TABLE transfer_items ADD COLUMN updated_at TEXT;
