const { openSqlite } = require('../drivers/sqlite/db')
const { buildPurchaseReportGlobalTotalsSql } = require('../drivers/sqlite/purchases/globalTotalsQueries')
const {
  buildIngredientPurchaseReportAnalyticsSql,
  normalizeIngredientPurchaseReportRow,
} = require('../drivers/sqlite/purchases/ingredientReportQueries')
const {
  buildPurchaseTimelineSql,
  normalizePurchaseTimelineReportRow,
} = require('../drivers/sqlite/purchases/timelineReportQueries')
const { PurchaseReportGlobalTotalsSchema } = require('../models/purchase/reportSchema')

function get(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err)
      resolve(row)
    })
  })
}

function all(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err)
      resolve(rows)
    })
  })
}

class PurchaseReportRepository {
  constructor() {
    this.db = openSqlite()
  }

  /**
   * @param {import('zod').infer<typeof import('../models/purchase/reportSchema').PurchaseReportFilterSchema>} filters
   */
  async listIngredientAnalytics(filters) {
    const { sql, params } = buildIngredientPurchaseReportAnalyticsSql(filters)
    const rows = await all(this.db, sql, params)
    return rows.map((row) => normalizeIngredientPurchaseReportRow(row))
  }

  /**
   * @param {import('zod').infer<typeof import('../models/purchase/reportSchema').PurchaseReportFilterSchema>} filters
   */
  async listTimeline(filters) {
    const { sql, params } = buildPurchaseTimelineSql(filters)
    const rows = await all(this.db, sql, params)
    return rows.map((row) => normalizePurchaseTimelineReportRow(row))
  }

  /**
   * @param {import('zod').infer<typeof import('../models/purchase/reportSchema').PurchaseReportFilterSchema>} filters
   */
  async fetchGlobalTotals(filters) {
    const { sql, params } = buildPurchaseReportGlobalTotalsSql(filters)
    const row = await get(this.db, sql, params)
    return PurchaseReportGlobalTotalsSchema.parse({
      total_purchase_amount: row?.total_purchase_amount ?? 0,
      total_purchase_entries: row?.total_purchase_entries ?? 0,
      total_unique_ingredients: row?.total_unique_ingredients ?? 0,
    })
  }
}

module.exports = { PurchaseReportRepository }
