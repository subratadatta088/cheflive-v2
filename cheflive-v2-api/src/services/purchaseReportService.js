const { PurchaseReportAnalyticsRowSchema } = require('../models/purchase/reportSchema')

function round1(n) {
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 10) / 10
}

function unitOrFallback(lineUnit, defaultUnit) {
  const u = lineUnit != null ? String(lineUnit).trim() : ''
  if (u) return u
  return defaultUnit != null ? String(defaultUnit).trim() : ''
}

function pickMaxBy(rows, key, tieKey) {
  if (!rows.length) return null
  return rows.reduce((best, row) => {
    const v = Number(row[key])
    const bestV = Number(best[key])
    if (!Number.isFinite(v)) return best
    if (!Number.isFinite(bestV) || v > bestV) return row
    if (v === bestV && tieKey) {
      const t = Number(row[tieKey])
      const bt = Number(best[tieKey])
      if (Number.isFinite(t) && Number.isFinite(bt) && t > bt) return row
    }
    return best
  })
}

function toAnalyticsRow(row, totalAmount) {
  const totalSpend = Number(row.total_subtotal) || 0
  const spendPct = totalAmount > 0 ? round1((totalSpend / totalAmount) * 100) : 0
  const defaultUnit = row.unit ?? ''
  return PurchaseReportAnalyticsRowSchema.parse({
    ingredient_id: row.ingredient_id,
    ingredient_name: row.ingredient_name,
    unit: defaultUnit,
    total_quantity: row.total_quantity,
    total_spend: totalSpend,
    purchase_frequency: row.total_purchase_entries,
    purchase_frequency_days_avg: row.purchase_frequency_days_avg,
    avg_rate: row.avg_rate,
    highest_rate: row.highest_rate,
    lowest_rate: row.lowest_rate,
    rate_variance: row.rate_variance,
    last_purchase_date: row.last_purchase_date ?? null,
    last_purchase_qty: row.last_purchase_qty ?? null,
    last_purchase_rate: row.last_purchase_rate ?? null,
    last_purchase_unit: unitOrFallback(row.last_purchase_unit, defaultUnit),
    spend_percentage: spendPct,
  })
}

function buildSpendSlice(row) {
  return {
    ingredient_name: row.ingredient_name,
    total_spend: row.total_spend,
    total_quantity: row.total_quantity,
    unit: row.unit,
    percentage: row.spend_percentage ?? 0,
  }
}

function buildHighestSpendKpi(row) {
  if (!row) return null
  return {
    ingredient_name: row.ingredient_name,
    total_spend: row.total_spend,
    total_quantity: row.total_quantity,
    unit: row.unit,
    spend_percentage: row.spend_percentage,
  }
}

function buildMostFrequentKpi(row) {
  if (!row) return null
  return {
    ingredient_name: row.ingredient_name,
    purchase_frequency: row.purchase_frequency,
    purchase_frequency_days_avg: row.purchase_frequency_days_avg,
    total_quantity: row.total_quantity,
    unit: row.unit,
    total_spend: row.total_spend,
  }
}

function buildMostVolatileKpi(rawRow, tableRow) {
  if (!rawRow || !tableRow) return null
  const spread = Number(rawRow.rate_variance)
  if (!Number.isFinite(spread)) return null
  return {
    ingredient_name: tableRow.ingredient_name,
    rate_spread: spread,
    highest_rate: rawRow.highest_rate ?? null,
    highest_rate_date: rawRow.highest_rate_date ?? null,
    highest_rate_qty: rawRow.highest_rate_qty ?? null,
    highest_rate_unit: unitOrFallback(rawRow.highest_rate_unit, tableRow.unit),
    lowest_rate: rawRow.lowest_rate ?? null,
    lowest_rate_date: rawRow.lowest_rate_date ?? null,
    lowest_rate_qty: rawRow.lowest_rate_qty ?? null,
    lowest_rate_unit: unitOrFallback(rawRow.lowest_rate_unit, tableRow.unit),
  }
}

function buildHighlights(kpis, charts) {
  const lines = []
  const top5Pct = kpis.top_5_spend_contribution_percentage
  if (Number.isFinite(top5Pct) && top5Pct > 0) {
    lines.push(`Top 5 ingredients contribute ${round1(top5Pct)}% of total purchase spend`)
  }
  const top = kpis.highest_spend_ingredient
  if (top?.ingredient_name) {
    lines.push(
      `${top.ingredient_name} is the highest invested ingredient (${round1(top.spend_percentage)}% of spend)`,
    )
  }
  const freq = kpis.most_frequently_purchased_ingredient
  if (freq?.ingredient_name && Number.isFinite(freq.purchase_frequency_days_avg)) {
    lines.push(
      `${freq.ingredient_name} is purchased every ${round1(freq.purchase_frequency_days_avg)} days on average`,
    )
  }
  const volatile = kpis.most_volatile_ingredient
  if (volatile?.ingredient_name && Number.isFinite(volatile.rate_spread)) {
    lines.push(
      `${volatile.ingredient_name} has the widest rate spread (INR ${round1(volatile.rate_spread)})`,
    )
  }
  const dist = charts?.top_spend_distribution
  if (Array.isArray(dist) && dist.length >= 2) {
    const second = dist[1]
    if (second?.ingredient_name && Number.isFinite(second.percentage)) {
      lines.push(`${second.ingredient_name} is the second largest spend category (${round1(second.percentage)}%)`)
    }
  }
  return lines.slice(0, 5)
}

class PurchaseReportService {
  /**
   * @param {{ models: { purchaseReport: import('../repositories/PurchaseReportRepository').PurchaseReportRepository } }} ctx
   */
  constructor(ctx) {
    this.repo = ctx?.models?.purchaseReport
  }

  /**
   * @param {import('zod').infer<typeof import('../models/purchase/reportSchema').PurchaseReportFilterSchema>} filters
   */
  async getAnalytics(filters) {
    const [rawRows, globalTotals] = await Promise.all([
      this.repo.listIngredientAnalytics(filters),
      this.repo.fetchGlobalTotals(filters),
    ])

    const totalAmount = Number(globalTotals.total_purchase_amount) || 0
    const table = rawRows.map((row) => toAnalyticsRow(row, totalAmount))

    const rawByIngredientId = new Map(rawRows.map((r) => [Number(r.ingredient_id), r]))

    const top5 = [...table].sort((a, b) => b.total_spend - a.total_spend).slice(0, 5)
    const top_spend_distribution = top5.map((row) => buildSpendSlice(row))

    const top5SpendSum = top5.reduce((s, r) => s + (Number(r.total_spend) || 0), 0)
    const top_5_spend_contribution_percentage =
      totalAmount > 0 ? round1((top5SpendSum / totalAmount) * 100) : 0

    const highestSpend = pickMaxBy(table, 'total_spend')
    const mostFrequent = pickMaxBy(table, 'purchase_frequency', 'total_spend')
    const mostVolatileTable = pickMaxBy(table, 'rate_variance')
    const volatileRaw =
      mostVolatileTable != null
        ? rawByIngredientId.get(Number(mostVolatileTable.ingredient_id))
        : null

    const kpis = {
      total_purchase_amount: totalAmount,
      total_purchase_entries: globalTotals.total_purchase_entries,
      total_unique_ingredients: globalTotals.total_unique_ingredients,
      highest_spend_ingredient: buildHighestSpendKpi(highestSpend),
      most_frequently_purchased_ingredient: buildMostFrequentKpi(mostFrequent),
      most_volatile_ingredient: buildMostVolatileKpi(volatileRaw, mostVolatileTable),
      top_5_spend_contribution_percentage,
    }

    const charts = { top_spend_distribution }
    const highlights = buildHighlights(kpis, charts)

    return { kpis, table, charts, highlights }
  }

  /**
   * @param {import('zod').infer<typeof import('../models/purchase/reportSchema').PurchaseReportFilterSchema>} filters
   */
  async getTimeline(filters) {
    const rows = await this.repo.listTimeline(filters)
    const items = rows.map((row) => ({
      date: row.purchase_day,
      total_purchase_amount: row.total_purchase_amount,
      total_purchase_entries: row.total_purchase_entries,
      total_purchase_items: row.total_purchase_items,
      total_quantity: row.total_quantity,
    }))
    return { items }
  }
}

module.exports = { PurchaseReportService }
