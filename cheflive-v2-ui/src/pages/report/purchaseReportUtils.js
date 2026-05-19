export const MAX_REPORT_RANGE_DAYS = 183

function parseIsoDateOnly(value) {
  const s = String(value ?? '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  const d = new Date(`${s}T00:00:00.000Z`)
  if (Number.isNaN(d.getTime())) return null
  return d
}

function toDateInputValue(d) {
  return d.toISOString().slice(0, 10)
}

export function defaultReportDateRange() {
  const to = new Date()
  const from = new Date(to)
  from.setUTCDate(from.getUTCDate() - 29)
  return { from_date: toDateInputValue(from), to_date: toDateInputValue(to) }
}

/**
 * @param {string} fromDate
 * @param {string} toDate
 * @returns {{ ok: true } | { ok: false, error: string }}
 */
export function validateReportDateRange(fromDate, toDate) {
  const from = parseIsoDateOnly(fromDate)
  const to = parseIsoDateOnly(toDate)
  if (!from) return { ok: false, error: 'From date is required (YYYY-MM-DD).' }
  if (!to) return { ok: false, error: 'To date is required (YYYY-MM-DD).' }
  if (to < from) return { ok: false, error: 'To date must be on or after from date.' }
  const spanMs = to.getTime() - from.getTime()
  const spanDays = Math.floor(spanMs / 86400000) + 1
  if (spanDays > MAX_REPORT_RANGE_DAYS) {
    return { ok: false, error: `Date range cannot exceed ${MAX_REPORT_RANGE_DAYS} days (6 months).` }
  }
  return { ok: true }
}

/**
 * Inclusive day count for a report filter (from and to dates both count).
 * @param {string} fromDate
 * @param {string} toDate
 * @returns {number | null}
 */
export function getReportDateRangeDayCount(fromDate, toDate) {
  const from = parseIsoDateOnly(fromDate)
  const to = parseIsoDateOnly(toDate)
  if (!from || !to || to < from) return null
  return Math.floor((to.getTime() - from.getTime()) / 86400000) + 1
}

/**
 * @param {number | null | undefined} dayCount
 * @returns {string} e.g. "30 days" or "1 day"
 */
export function formatReportRangeDaysPhrase(dayCount) {
  const n = Number(dayCount)
  if (!Number.isFinite(n) || n <= 0) return ''
  return n === 1 ? '1 day' : `${n} days`
}

function formatInrNumber(n, options = {}) {
  const num = Number(n)
  if (!Number.isFinite(num)) return '—'
  const formatted = new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: options.maximumFractionDigits ?? 0,
    minimumFractionDigits: options.minimumFractionDigits,
  }).format(num)
  return `INR ${formatted}`
}

export function formatReportCurrency(n) {
  return formatInrNumber(n)
}

/** INR with decimals (rates, line amounts in table). */
export function formatReportMoney(n) {
  const num = Number(n)
  if (!Number.isFinite(num)) return '—'
  const formatted = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num)
  return `INR ${formatted}`
}

export function formatReportPercent(n) {
  if (!Number.isFinite(Number(n))) return '—'
  return `${Number(n).toFixed(1)}%`
}

/** Split qty and unit for separate styling: { qty, unit } */
export function splitQtyUnit(qty, unit) {
  const n = Number(qty)
  const u = unit != null ? String(unit).trim() : ''
  if (!Number.isFinite(n)) return { qty: '—', unit: u }
  const qtyStr = n % 1 === 0 ? String(n) : n.toFixed(3).replace(/\.?0+$/, '')
  return { qty: qtyStr, unit: u }
}

/** Compact INR for large KPI amounts (e.g. INR 2.45L). */
export function formatReportCurrencyCompact(n) {
  const num = Number(n)
  if (!Number.isFinite(num)) return '—'
  if (Math.abs(num) >= 100000) {
    const lakhs = num / 100000
    const str = lakhs >= 10 ? lakhs.toFixed(0) : lakhs.toFixed(2).replace(/\.?0+$/, '')
    return `INR ${str}L`
  }
  return formatReportCurrency(num)
}

export function formatQtyWithUnit(qty, unit) {
  const n = Number(qty)
  const u = unit != null ? String(unit).trim().toUpperCase() : ''
  if (!Number.isFinite(n)) return u || '—'
  const qtyStr = n % 1 === 0 ? String(n) : n.toFixed(2).replace(/\.?0+$/, '')
  return u ? `${qtyStr} (${u})` : qtyStr
}

/**
 * Average days between purchases spread across the report period (not calendar gap between two dates).
 * e.g. 2 times in 30 days → ~15 days.
 * @param {number | null | undefined} rangeDays
 * @param {number | null | undefined} purchaseCount
 */
export function computePurchasePaceDaysInPeriod(rangeDays, purchaseCount) {
  const period = Number(rangeDays)
  const n = Number(purchaseCount) || 0
  if (!Number.isFinite(period) || period <= 0 || n <= 1) return null
  return period / n
}

/**
 * @param {number | null | undefined} totalQty
 * @param {number | null | undefined} purchaseCount
 */
export function computeAvgQtyPerPurchase(totalQty, purchaseCount) {
  const total = Number(totalQty)
  const n = Number(purchaseCount) || 0
  if (!Number.isFinite(total) || n <= 0) return null
  return total / n
}

export function formatReportDateShort(iso) {
  const s = String(iso ?? '').trim()
  if (!/^\d{4}-\d{2}-\d{2}/.test(s)) return s || '—'
  const d = new Date(`${s.slice(0, 10)}T00:00:00.000Z`)
  if (Number.isNaN(d.getTime())) return s
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function ordinalDay(n) {
  const j = n % 10
  const k = n % 100
  if (j === 1 && k !== 11) return `${n}st`
  if (j === 2 && k !== 12) return `${n}nd`
  if (j === 3 && k !== 13) return `${n}rd`
  return `${n}th`
}

/**
 * @param {string} iso YYYY-MM-DD
 * @param {{ includeYear?: boolean }} [opts]
 */
export function formatReportDateOrdinal(iso, opts = {}) {
  const d = parseIsoDateOnly(iso)
  if (!d) return ''
  const includeYear = opts.includeYear !== false
  const month = d.toLocaleDateString('en-IN', { month: 'short', timeZone: 'UTC' })
  const base = `${ordinalDay(d.getUTCDate())} ${month}`
  return includeYear ? `${base} ${d.getUTCFullYear()}` : base
}

/**
 * Human-readable range for report headers, e.g. "(10th Jun – 24th Jul 2026)".
 * @param {string} fromDate
 * @param {string} toDate
 */
export function formatReportDateRangeLabel(fromDate, toDate) {
  const from = parseIsoDateOnly(fromDate)
  const to = parseIsoDateOnly(toDate)
  if (!from || !to) return ''

  const sameYear = from.getUTCFullYear() === to.getUTCFullYear()
  const fromPart = formatReportDateOrdinal(fromDate, { includeYear: !sameYear })
  const toPart = formatReportDateOrdinal(toDate, { includeYear: true })

  if (sameYear) {
    return `(${fromPart} – ${toPart})`
  }
  return `(${fromPart} – ${toPart})`
}
