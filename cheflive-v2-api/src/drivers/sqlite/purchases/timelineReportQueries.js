const {
  PurchaseReportTimelineQuerySchema,
  PurchaseReportTimelineRowSchema,
} = require('../../../models/purchase/reportSchema')
const { buildPurchaseReportFilters } = require('./purchaseReportFilters')

/**
 * Daily purchase timeline from purchase_items (amounts come from line subtotals).
 * @param {import('zod').infer<typeof PurchaseReportTimelineQuerySchema>} q
 */
function buildPurchaseTimelineSql(q) {
  const { whereSql, params, needsIngredientJoin } = buildPurchaseReportFilters(q)

  const ingredientJoin = needsIngredientJoin
    ? `INNER JOIN ingredients ing_f
    ON ing_f.id = pi.ingredient_id
   AND ing_f.organization_id = pi.organization_id
   AND (ing_f.deleted_at IS NULL OR ing_f.deleted_at = '')`
    : ''

  const sql = `
SELECT
  DATE(p.date) AS purchase_day,
  SUM(pi.qty * COALESCE(pi.unit_price, 0)) AS total_purchase_amount,
  COUNT(DISTINCT p.id) AS total_purchase_entries,
  COUNT(pi.id) AS total_purchase_items,
  SUM(pi.qty) AS total_quantity
FROM purchase_items pi
INNER JOIN purchases p
  ON p.id = pi.purchase_id
 AND p.organization_id = pi.organization_id
${ingredientJoin}
WHERE ${whereSql}
GROUP BY DATE(p.date)
ORDER BY purchase_day ASC`

  return { sql, params }
}

function parsePurchaseTimelineReportQuery(raw) {
  return PurchaseReportTimelineQuerySchema.parse(raw)
}

function normalizePurchaseTimelineReportRow(row) {
  return PurchaseReportTimelineRowSchema.parse({
    purchase_day: row.purchase_day ?? '',
    total_purchase_amount: row.total_purchase_amount ?? 0,
    total_purchase_entries: row.total_purchase_entries ?? 0,
    total_purchase_items: row.total_purchase_items ?? 0,
    total_quantity: row.total_quantity ?? 0,
  })
}

module.exports = {
  buildPurchaseTimelineSql,
  parsePurchaseTimelineReportQuery,
  normalizePurchaseTimelineReportRow,
}
