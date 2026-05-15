/** @param {number} n */
export function formatQtyDisplay(n) {
  if (!Number.isFinite(n)) return '—'
  return n % 1 === 0 ? String(n) : n.toFixed(3).replace(/\.?0+$/, '')
}

/** @param {number} n */
export function formatMoney(n) {
  if (!Number.isFinite(n)) return '—'
  return n.toFixed(2)
}
