import { useCallback, useEffect, useId, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '../../../components/Button.jsx'
import { LineItemsGrid } from '../../../components/LineItemsGrid.jsx'
import { listIngredients } from '../../../apis/ingredient.js'
import { buildStockAdjustColumns } from './stockAdjustColumns.jsx'
import { MOCK_STOCK_ADJUST_ROWS, createMockAdjustRow } from './stockAdjustMockData.js'

/**
 * Adjust-stock modal (UI only). Structured for future stock-adjust API.
 *
 * @param {{ open: boolean, onClose: () => void }} props
 */
export function StockAdjustModal({ open, onClose }) {
  const titleId = useId()
  const [rows, setRows] = useState(() => MOCK_STOCK_ADJUST_ROWS.map((r) => ({ ...r })))
  const [ingredientOptions, setIngredientOptions] = useState(() => /** @type {{ value: string, label: string }[]} */ ([]))
  const [loadingOptions, setLoadingOptions] = useState(false)

  useEffect(() => {
    if (!open) return
    setRows(MOCK_STOCK_ADJUST_ROWS.map((r) => ({ ...r })))
  }, [open])

  useEffect(() => {
    if (!open) return
    let alive = true
    ;(async () => {
      setLoadingOptions(true)
      try {
        const { items } = await listIngredients({ page: 1, limit: 100, is_active: 1 })
        if (!alive) return
        const opts = (Array.isArray(items) ? items : [])
          .map((ing) => {
            const id = Number(ing?.id)
            if (!Number.isFinite(id) || id <= 0) return null
            const name = ing?.name != null ? String(ing.name).trim() : ''
            const code = ing?.item_code != null ? String(ing.item_code) : ''
            const label = code && name ? `${code} — ${name}` : name || `Ingredient #${id}`
            return { value: String(id), label }
          })
          .filter(Boolean)
        setIngredientOptions(opts)
      } catch {
        if (alive) setIngredientOptions([])
      } finally {
        if (alive) setLoadingOptions(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const columns = useMemo(() => buildStockAdjustColumns({ ingredientOptions }), [ingredientOptions])

  const handleSubmit = useCallback(() => {
    const payload = rows.map((r) => ({
      ingredient_id: r.ingredient_id ? Number(r.ingredient_id) : null,
      adjusted_stock: r.adjusted_stock,
      remarks: r.remarks,
    }))
    console.info('[StockAdjustModal] submit (mock)', payload)
    onClose()
  }, [rows, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="presentation"
      onMouseDown={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-white shadow-lg"
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 id={titleId} className="text-base font-semibold text-slate-900">
            Adjust stock
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <p className="text-sm text-slate-600">
            Update quantities per ingredient. Saving is not connected to the API yet.
          </p>

          {loadingOptions ? <p className="mt-2 text-sm text-slate-500">Loading ingredients…</p> : null}

          <LineItemsGrid
            rows={rows}
            onRowsChange={setRows}
            createRow={createMockAdjustRow}
            columns={columns}
            minRows={1}
            className="mt-4"
          />
        </div>

        <div className="flex shrink-0 justify-end gap-2 border-t border-slate-200 px-4 py-3">
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="button" onClick={handleSubmit}>
            Save adjustments
          </Button>
        </div>
      </div>
    </div>
  )
}
