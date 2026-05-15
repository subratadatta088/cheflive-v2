/** @param {unknown} qty @param {unknown} unit @returns {{ qtyStr: string, unitStr: string } | null} */
export function parseDefaultStockParts(qty, unit) {
  const u = unit === undefined || unit === null ? '' : String(unit).trim()
  const raw = qty === undefined || qty === null ? NaN : Number(qty)
  if (!Number.isFinite(raw)) return null
  const qStr = raw % 1 === 0 ? String(raw) : String(raw)
  return { qtyStr: qStr, unitStr: u }
}

/**
 * Merge running-stock API response into a purchase line row (display + optional reorder qty).
 * @param {Record<string, unknown>} row
 * @param {Record<string, unknown>|null|undefined} stockData
 * @returns {Record<string, unknown>}
 */
export function applyStockAndReorderToRow(row, stockData) {
  const parts = parseDefaultStockParts(stockData?.qty, stockData?.unit)
  const minReorder = stockData?.minimum_reorder_qty
  const minNum = minReorder === null || minReorder === undefined ? NaN : Number(minReorder)
  const hasMinReorder = Number.isFinite(minNum) && minNum > 0

  const hasQty = String(row?.qty ?? '').trim() !== ''
  const unitFromStock = stockData?.unit ? String(stockData.unit) : parts?.unitStr ?? ''

  let next = {
    ...row,
    defaultStockLoading: false,
    defaultStockQtyStr: parts ? parts.qtyStr : '—',
    defaultStockUnit: parts?.unitStr ?? '',
  }

  if (hasMinReorder && !hasQty) {
    const qStr = minNum % 1 === 0 ? String(minNum) : String(minNum)
    next = {
      ...next,
      qty: qStr,
      unit: unitFromStock || String(row?.unit ?? ''),
    }
  }

  return next
}
