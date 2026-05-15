ALTER TABLE utilizations ADD COLUMN date TEXT;
UPDATE utilizations SET date = substr(created_at, 1, 10) WHERE date IS NULL AND created_at IS NOT NULL;
