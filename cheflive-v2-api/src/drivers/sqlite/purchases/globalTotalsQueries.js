const { buildPurchaseReportFilters } = require('./purchaseReportFilters')

/**
 * Org-wide totals for purchase report KPIs (from purchase_items lines).
 * @param {import('../../../models/purchase/reportSchema').PurchaseReportFilterSchema} q
 */
function buildPurchaseReportGlobalTotalsSql(q) {
  const { whereSql, params, needsIngredientJoin } = buildPurchaseReportFilters(q)

  const ingredientJoin = needsIngredientJoin
    ? `INNER JOIN ingredients ing_f
    ON ing_f.id = pi.ingredient_id
   AND ing_f.organization_id = pi.organization_id
   AND (ing_f.deleted_at IS NULL OR ing_f.deleted_at = '')`
    : ''

  const sql = `
SELECT
  COALESCE(SUM(pi.qty * COALESCE(pi.unit_price, 0)), 0) AS total_purchase_amount,
  COUNT(DISTINCT p.id) AS total_purchase_entries,
  COUNT(DISTINCT pi.ingredient_id) AS total_unique_ingredients
FROM purchase_items pi
INNER JOIN purchases p
  ON p.id = pi.purchase_id
 AND p.organization_id = pi.organization_id
${ingredientJoin}
WHERE ${whereSql}`

  return { sql, params }
}

module.exports = {
  buildPurchaseReportGlobalTotalsSql,
}
