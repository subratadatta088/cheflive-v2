/**
 * @param {Array<Record<string, unknown>>} rows
 * @param {{ from_date: string, to_date: string }} range
 */
export function downloadPurchaseReportCsv(rows, range) {
  const table = Array.isArray(rows) ? rows : []
  const headers = [
    'ingredient_name',
    'unit',
    'total_quantity',
    'total_spend',
    'purchase_frequency',
    'purchase_frequency_days_avg',
    'avg_rate',
    'highest_rate',
    'lowest_rate',
    'last_purchase_date',
    'last_purchase_qty',
    'last_purchase_unit',
    'last_purchase_rate',
    'spend_percentage',
  ]

  const escape = (v) => {
    const s = v == null ? '' : String(v)
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
    return s
  }

  const lines = [
    headers.join(','),
    ...table.map((row) => headers.map((h) => escape(row[h])).join(',')),
  ]

  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `purchase-report_${range.from_date}_${range.to_date}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * @param {{ from_date: string, to_date: string, highlights?: string[] }} meta
 */
export function sendPurchaseReportByEmail(meta) {
  const subject = encodeURIComponent(
    `Purchase report (${meta.from_date} to ${meta.to_date})`,
  )
  const body = encodeURIComponent(
    [
      'Please find the purchase report summary below.',
      '',
      `Period: ${meta.from_date} to ${meta.to_date}`,
      '',
      ...(Array.isArray(meta.highlights) && meta.highlights.length
        ? ['Highlights:', ...meta.highlights.map((h) => `- ${h}`), '']
        : []),
      'Generated from ChefLive.',
    ].join('\n'),
  )
  window.location.href = `mailto:?subject=${subject}&body=${body}`
}
