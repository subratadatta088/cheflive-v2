import { useCallback, useState } from 'react'
import { getPurchaseLowStockItems } from './purchaseLowStockApi.js'
import { mapLowStockToPurchaseRows } from './mapLowStockToPurchaseRows.js'

/** @param {Record<string, unknown>|null|undefined} row */
function isEmptyPurchaseRow(row) {
  return !String(row?.ingredient_id ?? '').trim()
}

/**
 * @param {{
 *   setRows: (updater: (prev: unknown[]) => unknown[]) => void,
 *   onRowsAppended?: (rows: Array<{ id: string, ingredient_id: string }>) => void,
 * }} options
 */
export function usePurchaseLowStock({ setRows, onRowsAppended }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const appendLowStockRows = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const { items } = await getPurchaseLowStockItems()
      const mapped = mapLowStockToPurchaseRows(items)
      if (!mapped.length) {
        setError('No low-stock items found.')
        return { added: 0 }
      }

      let added = 0
      const appended = []

      setRows((prev) => {
        const list = Array.isArray(prev) ? [...prev] : []
        const existingIds = new Set(
          list.map((r) => String(r?.ingredient_id ?? '')).filter((id) => id !== ''),
        )

        for (const row of mapped) {
          const ingKey = String(row.ingredient_id ?? '')
          if (!ingKey || existingIds.has(ingKey)) continue
          existingIds.add(ingKey)

          const lastIdx = list.length - 1
          const lastRow = lastIdx >= 0 ? list[lastIdx] : null
          let placed
          if (lastRow && isEmptyPurchaseRow(lastRow)) {
            placed = { ...row, id: lastRow.id }
            list[lastIdx] = placed
          } else {
            placed = row
            list.push(placed)
          }
          appended.push(placed)
          added += 1
        }

        return list.length ? list : mapped
      })

      onRowsAppended?.(appended)
      return { added, appended }
    } catch (e) {
      const msg = e?.response?.data?.error || e?.message || 'Failed to load low-stock items'
      setError(msg)
      return { added: 0, error: msg }
    } finally {
      setLoading(false)
    }
  }, [setRows, onRowsAppended])

  return { loading, error, appendLowStockRows, clearError: () => setError('') }
}
