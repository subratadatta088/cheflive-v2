-- Legacy DBs may have created ingredient_unit_conversions without timestamps.
-- If the column already exists, the migration runner treats duplicate-column as already applied.
ALTER TABLE ingredient_unit_conversions ADD COLUMN created_at TEXT;

