-- `transfer_items.unit` exists on databases created from 001_init.sql; some older or
-- partially migrated DBs may lack it. Inserts must populate human-readable `unit`.
--
-- Duplicate column is tolerated by src/db/migrate.js (migration marked applied).

ALTER TABLE transfer_items ADD COLUMN unit TEXT;
