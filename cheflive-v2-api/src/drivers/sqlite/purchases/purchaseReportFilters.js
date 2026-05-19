const { PurchaseReportFilterSchema } = require('../../../models/purchase/reportSchema')

/**
 * WHERE + params for purchase_items ⨝ purchases reports (aggregates from line items).
 * @param {import('zod').infer<typeof PurchaseReportFilterSchema>} q
 */
function buildPurchaseReportFilters(q) {
  const where = [
    'pi.organization_id = ?',
    "(pi.deleted_at IS NULL OR pi.deleted_at = '')",
    "(p.deleted_at IS NULL OR p.deleted_at = '')",
    'p.date >= ?',
    'p.date <= ?',
  ]
  const params = [q.organization_id, q.from_date, q.to_date]

  if (q.branch_id) {
    where.push('p.origin_id = ?')
    params.push(q.branch_id)
  }

  if (q.vendor_id) {
    where.push('p.origin_id = ?')
    params.push(q.vendor_id)
  }

  if (Array.isArray(q.ingredient_ids) && q.ingredient_ids.length) {
    const unique = [...new Set(q.ingredient_ids.map((n) => Number(n)).filter((n) => Number.isFinite(n) && n > 0))]
    if (unique.length) {
      where.push(`pi.ingredient_id IN (${unique.map(() => '?').join(', ')})`)
      params.push(...unique)
    }
  }

  const needsIngredientJoin =
    Array.isArray(q.category_ids) && q.category_ids.length > 0

  if (needsIngredientJoin) {
    const unique = [...new Set(q.category_ids.map((n) => Number(n)).filter((n) => Number.isFinite(n) && n > 0))]
    if (unique.length) {
      where.push(`ing_f.category_id IN (${unique.map(() => '?').join(', ')})`)
      params.push(...unique)
    }
  }

  return {
    whereSql: where.join(' AND '),
    params,
    needsIngredientJoin,
  }
}

function parsePurchaseReportFilters(raw) {
  return PurchaseReportFilterSchema.parse(raw)
}

module.exports = {
  buildPurchaseReportFilters,
  parsePurchaseReportFilters,
}
