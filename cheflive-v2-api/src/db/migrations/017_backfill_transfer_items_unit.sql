-- Populate missing `unit` from the ingredient's default unit string.

UPDATE transfer_items
SET unit = COALESCE(
  (
    SELECT trim(i.unit)
    FROM ingredients i
    WHERE i.id = transfer_items.ingredient_id
      AND i.organization_id = transfer_items.organization_id
      AND (i.deleted_at IS NULL OR i.deleted_at = '')
    LIMIT 1
  ),
  ''
)
WHERE transfer_items.unit IS NULL OR trim(COALESCE(transfer_items.unit, '')) = '';
