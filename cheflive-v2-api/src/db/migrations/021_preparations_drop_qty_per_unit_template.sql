-- Preparations are recipe templates: ingredient lines define amounts per 1 unit of output.
-- Output unit is stored in preparations.unit; batch size belongs on utilizations only.
-- Requires SQLite 3.35+ (DROP COLUMN).

ALTER TABLE preparations DROP COLUMN qty;
