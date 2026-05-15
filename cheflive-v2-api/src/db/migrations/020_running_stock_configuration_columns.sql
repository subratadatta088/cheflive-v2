ALTER TABLE running_stock ADD COLUMN opening_stock_qty REAL;
ALTER TABLE running_stock ADD COLUMN opening_stock_unit TEXT;
ALTER TABLE running_stock ADD COLUMN reorder_threshold_qty REAL;
ALTER TABLE running_stock ADD COLUMN reorder_threshold_unit TEXT;
ALTER TABLE running_stock ADD COLUMN minimum_reorder_qty REAL;
ALTER TABLE running_stock ADD COLUMN minimum_reorder_unit TEXT;
