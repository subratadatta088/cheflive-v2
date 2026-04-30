-- Legacy DBs may have created ingredient_unit_conversions without soft-delete.
-- If the column already exists, the migration runner treats duplicate-column as already applied.
ALTER TABLE ingredient_unit_conversions ADD COLUMN deleted_at TEXT;
