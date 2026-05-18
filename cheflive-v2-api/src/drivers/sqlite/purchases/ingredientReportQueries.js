const {
  PurchaseReportIngredientQuerySchema,
  PurchaseReportIngredientRowSchema,
} = require('../../../models/purchase/reportSchema')
const { buildPurchaseReportFilters } = require('./purchaseReportFilters')

/** @type {Record<string, string>} */
const SORT_COLUMN_SQL = {
  ingredient_name: 'ing.name COLLATE NOCASE',
  total_purchase_entries: 'ia.total_purchase_entries',
  total_quantity: 'ia.total_quantity',
  total_subtotal: 'ia.total_subtotal',
  avg_rate: 'ia.avg_rate',
  highest_rate: 'ia.highest_rate',
  lowest_rate: 'ia.lowest_rate',
  last_purchase_date: 'ia.last_purchase_date',
  purchase_frequency_days_avg: 'pf.purchase_frequency_days_avg',
}

/** @param {import('zod').infer<typeof PurchaseReportIngredientQuerySchema>} q */
function buildFilteredPurchaseItemsWhere(q) {
  const { whereSql, params } = buildPurchaseReportFilters(q)
  return { whereSql, params }
}

/**
 * CTE stack: filtered lines → aggregates → last purchase row → purchase-date frequency.
 * @param {{ whereSql: string }} options
 */
function buildIngredientPurchaseReportCtes({ whereSql }) {
  return `
WITH filtered_purchase_items AS (
  SELECT
    pi.id,
    pi.purchase_id,
    pi.ingredient_id,
    pi.qty,
    pi.unit_price,
    (pi.qty * COALESCE(pi.unit_price, 0)) AS subtotal,
    pi.unit,
    p.date AS purchase_date,
    p.origin_id
  FROM purchase_items pi
  INNER JOIN purchases p
    ON p.id = pi.purchase_id
   AND p.organization_id = pi.organization_id
  INNER JOIN ingredients ing_f
    ON ing_f.id = pi.ingredient_id
   AND ing_f.organization_id = pi.organization_id
   AND (ing_f.deleted_at IS NULL OR ing_f.deleted_at = '')
  WHERE ${whereSql}
),
ingredient_aggregates AS (
  SELECT
    fpi.ingredient_id,
    COUNT(*) AS total_purchase_entries,
    SUM(fpi.qty) AS total_quantity,
    SUM(fpi.subtotal) AS total_subtotal,
    AVG(fpi.unit_price) AS avg_rate,
    MAX(fpi.unit_price) AS highest_rate,
    MIN(fpi.unit_price) AS lowest_rate,
    MAX(fpi.purchase_date) AS last_purchase_date
  FROM filtered_purchase_items fpi
  GROUP BY fpi.ingredient_id
),
last_purchase_details AS (
  SELECT
    ingredient_id,
    purchase_date,
    qty AS last_purchase_qty,
    unit_price AS last_purchase_rate,
    unit AS line_unit
  FROM (
    SELECT
      fpi.ingredient_id,
      fpi.purchase_date,
      fpi.qty,
      fpi.unit_price,
      fpi.unit,
      ROW_NUMBER() OVER (
        PARTITION BY fpi.ingredient_id
        ORDER BY fpi.purchase_date DESC, fpi.purchase_id DESC, fpi.id DESC
      ) AS rn
    FROM filtered_purchase_items fpi
  )
  WHERE rn = 1
),
purchase_dates AS (
  SELECT DISTINCT
    ingredient_id,
    purchase_date
  FROM filtered_purchase_items
),
purchase_frequency AS (
  SELECT
    ingredient_id,
    AVG(days_between) AS purchase_frequency_days_avg
  FROM (
    SELECT
      ingredient_id,
      JULIANDAY(purchase_date)
        - JULIANDAY(
            LAG(purchase_date) OVER (
              PARTITION BY ingredient_id
              ORDER BY purchase_date
            )
          ) AS days_between
    FROM purchase_dates
  )
  WHERE days_between IS NOT NULL
  GROUP BY ingredient_id
)`
}

/**
 * @param {import('zod').infer<typeof PurchaseReportIngredientQuerySchema>} q
 */
function buildIngredientPurchaseReportCountSql(q) {
  const { whereSql, params } = buildFilteredPurchaseItemsWhere(q)
  const ctes = buildIngredientPurchaseReportCtes({ whereSql })
  const sql = `${ctes}
SELECT COUNT(*) AS total
FROM ingredient_aggregates`
  return { sql, params }
}

/**
 * @param {import('zod').infer<typeof PurchaseReportIngredientQuerySchema>} q
 */
function buildIngredientPurchaseReportListSql(q) {
  const { whereSql, params } = buildFilteredPurchaseItemsWhere(q)
  const ctes = buildIngredientPurchaseReportCtes({ whereSql })

  const sortCol = SORT_COLUMN_SQL[q.sort_by] || SORT_COLUMN_SQL.total_subtotal
  const sortDir = q.sort_order === 'asc' ? 'ASC' : 'DESC'

  const sql = `${ctes}
SELECT
  ing.id AS ingredient_id,
  ing.name AS ingredient_name,
  ing.unit AS unit,
  ia.total_purchase_entries,
  ia.total_quantity,
  ia.total_subtotal,
  ROUND(ia.avg_rate, 2) AS avg_rate,
  ia.highest_rate,
  ia.lowest_rate,
  ia.last_purchase_date,
  lpd.last_purchase_qty,
  lpd.last_purchase_rate,
  pf.purchase_frequency_days_avg
FROM ingredient_aggregates ia
INNER JOIN ingredients ing
  ON ing.id = ia.ingredient_id
 AND ing.organization_id = ?
 AND (ing.deleted_at IS NULL OR ing.deleted_at = '')
LEFT JOIN last_purchase_details lpd
  ON lpd.ingredient_id = ia.ingredient_id
LEFT JOIN purchase_frequency pf
  ON pf.ingredient_id = ia.ingredient_id
ORDER BY ${sortCol} ${sortDir}, ing.id ASC
LIMIT ? OFFSET ?`

  const offset = (q.page - 1) * q.limit
  return { sql, params: [...params, q.organization_id, q.limit, offset] }
}

function parseIngredientPurchaseReportQuery(raw) {
  return PurchaseReportIngredientQuerySchema.parse(raw)
}

function normalizeIngredientPurchaseReportRow(row) {
  return PurchaseReportIngredientRowSchema.parse({
    ingredient_id: row.ingredient_id,
    ingredient_name: row.ingredient_name ?? '',
    unit: row.unit ?? '',
    total_purchase_entries: row.total_purchase_entries ?? 0,
    total_quantity: row.total_quantity ?? 0,
    total_subtotal: row.total_subtotal ?? 0,
    avg_rate: row.avg_rate ?? null,
    highest_rate: row.highest_rate ?? null,
    lowest_rate: row.lowest_rate ?? null,
    last_purchase_date: row.last_purchase_date ?? null,
    last_purchase_qty: row.last_purchase_qty ?? null,
    last_purchase_rate: row.last_purchase_rate ?? null,
    purchase_frequency_days_avg: row.purchase_frequency_days_avg ?? null,
  })
}

module.exports = {
  SORT_COLUMN_SQL,
  buildFilteredPurchaseItemsWhere,
  buildIngredientPurchaseReportCtes,
  buildIngredientPurchaseReportCountSql,
  buildIngredientPurchaseReportListSql,
  parseIngredientPurchaseReportQuery,
  normalizeIngredientPurchaseReportRow,
}
