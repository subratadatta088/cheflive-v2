-- Transfer lines use `unit` (TEXT) only; conversions resolve via ingredient_unit_conversions
-- by matching unit strings. Requires SQLite 3.35+ (DROP COLUMN).

ALTER TABLE transfer_items DROP COLUMN unit_id;
