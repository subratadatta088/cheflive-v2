/**
 * Dedupe and sort numeric row ids from table selection.
 * @param {unknown[]} selectedRowIds
 * @returns {number[]}
 */
export function normalizeSelectedIds(selectedRowIds) {
  const seen = new Set()
  const out = []
  for (const raw of selectedRowIds) {
    const n = Number(raw)
    if (!Number.isFinite(n) || n <= 0) continue
    if (seen.has(n)) continue
    seen.add(n)
    out.push(n)
  }
  out.sort((a, b) => a - b)
  return out
}
