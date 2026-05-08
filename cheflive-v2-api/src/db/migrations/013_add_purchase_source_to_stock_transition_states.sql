ALTER TABLE stock_transition_states ADD COLUMN source_purchase_id INTEGER;
ALTER TABLE stock_transition_states ADD COLUMN source_purchase_item_id INTEGER;

CREATE INDEX IF NOT EXISTS idx_sts_source_purchase
  ON stock_transition_states (source_purchase_id);

