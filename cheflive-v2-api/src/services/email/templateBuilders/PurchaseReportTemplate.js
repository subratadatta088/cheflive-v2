const { EmailTemplateService } = require('../EmailTemplateService')

const TEMPLATE_ID = 'purchase-report'

const PIE_COLORS = ['#000000', '#333333', '#555555', '#777777', '#999999', '#bbbbbb']
const PIE_RADIUS = 62
const PIE_CIRCUMFERENCE = 2 * Math.PI * PIE_RADIUS

function round1(n) {
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 10) / 10
}

/**
 * @param {string} fromDate YYYY-MM-DD
 * @param {string} toDate YYYY-MM-DD
 */
function formatPeriodLabel(fromDate, toDate) {
  const fmt = (iso) => {
    const d = new Date(`${iso}T00:00:00.000Z`)
    if (Number.isNaN(d.getTime())) return iso
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    })
  }
  if (fromDate === toDate) return fmt(fromDate)
  return `${fmt(fromDate)} – ${fmt(toDate)}`
}

/**
 * @param {Date | string} value
 */
function formatGeneratedAt(value) {
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

/**
 * @param {Array<{ percentage?: number, total_spend?: number, ingredient_name?: string }>} distribution
 * @param {number} totalSpend
 */
function buildPieSegments(distribution, totalSpend) {
  const items = Array.isArray(distribution) ? distribution.slice(0, 5) : []
  const top5Sum = items.reduce((s, r) => s + (Number(r.total_spend) || 0), 0)
  const othersSpend = Math.max(0, totalSpend - top5Sum)
  const othersPct = totalSpend > 0 ? round1((othersSpend / totalSpend) * 100) : 0

  let offset = 0
  const segments = items.map((row, index) => {
    const pct = Number(row.percentage) || 0
    const dash = (pct / 100) * PIE_CIRCUMFERENCE
    const segment = {
      ingredient_name: row.ingredient_name,
      percentage: round1(pct),
      total_spend: Number(row.total_spend) || 0,
      color: PIE_COLORS[index] ?? PIE_COLORS[PIE_COLORS.length - 1],
      dasharray: `${dash.toFixed(2)} ${(PIE_CIRCUMFERENCE - dash).toFixed(2)}`,
      dashoffset: (-offset).toFixed(2),
    }
    offset += dash
    return segment
  })

  if (othersSpend > 0.01) {
    const dash = (othersPct / 100) * PIE_CIRCUMFERENCE
    segments.push({
      ingredient_name: 'Others',
      percentage: othersPct,
      total_spend: othersSpend,
      color: PIE_COLORS[5],
      dasharray: `${dash.toFixed(2)} ${(PIE_CIRCUMFERENCE - dash).toFixed(2)}`,
      dashoffset: (-offset).toFixed(2),
      isOthers: true,
      othersCount: Math.max(0, (Array.isArray(distribution) ? distribution.length : 0) - 5),
    })
  }

  return segments
}

/**
 * @param {{
 *   analytics: {
 *     kpis: Record<string, unknown>,
 *     table: Array<Record<string, unknown>>,
 *     charts?: { top_spend_distribution?: Array<Record<string, unknown>> },
 *     highlights?: string[],
 *   },
 *   timeline?: { items?: Array<Record<string, unknown>> },
 *   fromDate: string,
 *   toDate: string,
 *   generatedAt?: Date | string,
 * }} payload
 */
function buildPurchaseReportEmailContext(payload) {
  const { analytics, timeline, fromDate, toDate } = payload
  const generatedAt = payload.generatedAt ?? new Date()
  const kpis = analytics?.kpis ?? {}
  const table = Array.isArray(analytics?.table) ? analytics.table : []
  const highlights = Array.isArray(analytics?.highlights) ? analytics.highlights : []
  const distribution = analytics?.charts?.top_spend_distribution ?? []

  const totalSpend = Number(kpis.total_purchase_amount) || 0
  const totalQty = table.reduce((s, r) => s + (Number(r.total_quantity) || 0), 0)
  const timelineItems = Array.isArray(timeline?.items) ? timeline.items : []
  const maxTimelineAmount = Math.max(
    ...timelineItems.map((i) => Number(i.total_purchase_amount) || 0),
    1,
  )

  const timelineRows = timelineItems.map((item) => ({
    date: item.date,
    dateLabel: formatPeriodLabel(String(item.date), String(item.date)),
    amount: Number(item.total_purchase_amount) || 0,
    barWidth: round1(((Number(item.total_purchase_amount) || 0) / maxTimelineAmount) * 100),
    entries: item.total_purchase_entries,
    lineItems: item.total_purchase_items,
    quantity: item.total_quantity,
  }))

  const timelinePills = [
    { label: 'Entries', value: kpis.total_purchase_entries },
    { label: 'Line items', value: timelineItems.reduce((s, i) => s + (Number(i.total_purchase_items) || 0), 0) },
    { label: 'Total units', value: round1(totalQty) },
    { label: 'Ingredients', value: kpis.total_unique_ingredients },
  ]

  const highest = /** @type {Record<string, unknown>} */ (kpis.highest_spend_ingredient ?? {})
  const frequent = /** @type {Record<string, unknown>} */ (kpis.most_frequently_purchased_ingredient ?? {})
  const volatile = /** @type {Record<string, unknown>} */ (kpis.most_volatile_ingredient ?? {})

  const tableRows = table.map((row, index) => {
    const variance = Number(row.rate_variance)
    return {
      index: index + 1,
      ingredient_name: row.ingredient_name,
      unit: row.unit,
      total_quantity: row.total_quantity,
      avg_rate: row.avg_rate,
      total_spend: row.total_spend,
      spend_percentage: round1(Number(row.spend_percentage) || 0),
      has_variance: Number.isFinite(variance) && variance > 0,
      rate_variance: round1(variance),
    }
  })

  return {
    title: `Purchase Report – ${formatPeriodLabel(fromDate, toDate)}`,
    periodLabel: formatPeriodLabel(fromDate, toDate),
    fromDate,
    toDate,
    generatedAtLabel: formatGeneratedAt(generatedAt),
    meta: {
      entriesCount: kpis.total_purchase_entries ?? 0,
      ingredientsCount: kpis.total_unique_ingredients ?? 0,
    },
    kpis: {
      totalSpend,
      totalQuantity: round1(totalQty),
      totalEntries: kpis.total_purchase_entries ?? 0,
      highestSpend: {
        name: highest.ingredient_name ?? '—',
        spend: highest.total_spend ?? 0,
        quantity: highest.total_quantity ?? 0,
        unit: highest.unit ?? '',
        percentage: round1(Number(highest.spend_percentage) || 0),
      },
      mostFrequent: {
        name: frequent.ingredient_name ?? '—',
        frequency: frequent.purchase_frequency ?? 0,
        quantity: frequent.total_quantity ?? 0,
        unit: frequent.unit ?? '',
        spend: frequent.total_spend ?? 0,
      },
      mostVolatile: volatile.ingredient_name
        ? {
            name: volatile.ingredient_name,
            spread: round1(Number(volatile.rate_spread) || 0),
            lowRate: volatile.lowest_rate ?? null,
            lowQty: volatile.lowest_rate_qty ?? null,
            lowUnit: volatile.lowest_rate_unit ?? '',
            highRate: volatile.highest_rate ?? null,
            highQty: volatile.highest_rate_qty ?? null,
            highUnit: volatile.highest_rate_unit ?? '',
          }
        : null,
    },
    timeline: {
      rows: timelineRows,
      pills: timelinePills,
    },
    pie: {
      segments: buildPieSegments(distribution, totalSpend),
      totalSpend,
    },
    highlights: highlights.map((text) => ({ text })),
    tableRows,
  }
}

/**
 * @param {Parameters<typeof buildPurchaseReportEmailContext>[0]} payload
 * @returns {string}
 */
function renderPurchaseReportHtml(payload) {
  const context = buildPurchaseReportEmailContext(payload)
  return EmailTemplateService.getInstance().render(TEMPLATE_ID, context)
}

module.exports = {
  PURCHASE_REPORT_TEMPLATE_ID: TEMPLATE_ID,
  buildPurchaseReportEmailContext,
  renderPurchaseReportHtml,
}
