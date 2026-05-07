import { useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { Button } from './Button.jsx'
import { LineItemsGrid } from './LineItemsGrid.jsx'
import { getIngredientById, listIngredientUnitConversions, upsertIngredientUnitConversions } from '../apis/ingredient.js'

function newRow() {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    conversion_id: null,
    a_qty: '1',
    a_unit: '',
    b_qty: '',
    b_unit: '',
    _status: '',
    _error: '',
  }
}

function normalizeUnit(v) {
  return String(v ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

function normalizeQty(v) {
  const s = String(v ?? '').trim()
  // allow digits + decimal point, keep it simple
  const cleaned = s.replace(/[^\d.]/g, '')
  // prevent multiple dots
  const parts = cleaned.split('.')
  if (parts.length <= 2) return cleaned
  return `${parts[0]}.${parts.slice(1).join('')}`
}

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

function computeFactor(aQtyRaw, bQtyRaw) {
  const a = Number(aQtyRaw)
  const b = Number(bQtyRaw)
  if (!Number.isFinite(a) || a <= 0) return null
  if (!Number.isFinite(b) || b <= 0) return null
  return round2(b / a)
}

/**
 * @param {{
 *  open: boolean,
 *  ingredient: { id: number, name?: string } | null,
 *  onClose: () => void,
 * }} props
 */
export function IngredientUnitConversionsModal({ open, ingredient, onClose }) {
  const ingredientId = Number(ingredient?.id)
  const [rows, setRows] = useState(() => /** @type {any[]} */ ([]))
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [ingredientMeta, setIngredientMeta] = useState(() => null)

  useEffect(() => {
    if (!open) return
    if (!Number.isFinite(ingredientId)) return
    let alive = true
    ;(async () => {
      setError('')
      setLoading(true)
      try {
        // Prefer details passed from parent; otherwise fetch.
        const hasMeta =
          ingredient &&
          (ingredient?.category_name ||
            ingredient?.unit ||
            ingredient?.base_price !== undefined ||
            ingredient?.item_code !== undefined)
        if (hasMeta) {
          setIngredientMeta(ingredient)
        } else {
          try {
            const ing = await getIngredientById(ingredientId)
            const v = ing?.ingredient ?? null
            if (alive) {
              setIngredientMeta({
                id: Number(v?.id) || ingredientId,
                name: String(v?.name ?? ''),
                category_name: String(v?.category_name ?? ''),
                unit: String(v?.unit ?? ''),
                base_price: v?.base_price === null || v?.base_price === undefined ? null : Number(v.base_price),
                item_code: v?.item_code === null || v?.item_code === undefined ? null : Number(v.item_code),
              })
            }
          } catch {
            if (alive) setIngredientMeta(ingredient)
          }
        }

        const data = await listIngredientUnitConversions(ingredientId)
        const items = Array.isArray(data?.items) ? data.items : []
        const mapped = items.map((c) => ({
          ...newRow(),
          id: String(c?.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`),
          conversion_id: Number(c?.id) || null,
          a_qty: '1',
          a_unit: String(c?.from_unit ?? ''),
          b_qty: c?.factor === null || c?.factor === undefined ? '' : String(c.factor),
          b_unit: String(c?.to_unit ?? ''),
        }))
        if (!alive) return
        setRows(mapped.length ? mapped : [newRow()])
      } catch (e) {
        if (!alive) return
        setRows([newRow()])
        setError(e?.response?.data?.message || e?.message || 'Failed to load conversions')
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [open, ingredientId])

  const columns = useMemo(
    () => [
      {
        key: 'a_qty',
        header: 'A qty',
        kind: 'custom',
        thClassName: 'w-28',
        align: 'right',
        render: ({ row, updateCell }) => (
          <input
            value={String(row?.a_qty ?? '')}
            onChange={(e) => updateCell('a_qty', normalizeQty(e.target.value))}
            inputMode="decimal"
            autoComplete="off"
            spellCheck={false}
            placeholder="1"
            className="box-border h-9 w-full min-w-[72px] border-0 bg-transparent px-2 py-1 text-sm tabular-nums text-slate-900 outline-none placeholder:text-slate-400 focus:bg-slate-50 focus:ring-2 focus:ring-inset focus:ring-slate-300"
          />
        ),
      },
      {
        key: 'a_unit',
        header: 'A unit',
        kind: 'custom',
        thClassName: 'w-32',
        render: ({ row, updateCell }) => (
          <input
            value={String(row?.a_unit ?? '')}
            onChange={(e) => updateCell('a_unit', normalizeUnit(e.target.value))}
            onBlur={(e) => updateCell('a_unit', normalizeUnit(e.target.value))}
            inputMode="text"
            autoComplete="off"
            spellCheck={false}
            placeholder="e.g. pc"
            className="box-border h-9 w-full min-w-[72px] border-0 bg-transparent px-2 py-1 text-sm tabular-nums text-slate-900 outline-none placeholder:text-slate-400 focus:bg-slate-50 focus:ring-2 focus:ring-inset focus:ring-slate-300"
          />
        ),
      },
      {
        key: 'b_qty',
        header: 'B qty',
        kind: 'custom',
        thClassName: 'w-28',
        align: 'right',
        render: ({ row, updateCell }) => (
          <input
            value={String(row?.b_qty ?? '')}
            onChange={(e) => updateCell('b_qty', normalizeQty(e.target.value))}
            inputMode="decimal"
            autoComplete="off"
            spellCheck={false}
            placeholder="e.g. 1"
            className="box-border h-9 w-full min-w-[72px] border-0 bg-transparent px-2 py-1 text-sm tabular-nums text-slate-900 outline-none placeholder:text-slate-400 focus:bg-slate-50 focus:ring-2 focus:ring-inset focus:ring-slate-300"
          />
        ),
      },
      {
        key: 'b_unit',
        header: 'B unit',
        kind: 'custom',
        thClassName: 'w-32',
        render: ({ row, updateCell }) => (
          <input
            value={String(row?.b_unit ?? '')}
            onChange={(e) => updateCell('b_unit', normalizeUnit(e.target.value))}
            onBlur={(e) => updateCell('b_unit', normalizeUnit(e.target.value))}
            inputMode="text"
            autoComplete="off"
            spellCheck={false}
            placeholder="e.g. pack"
            className="box-border h-9 w-full min-w-[72px] border-0 bg-transparent px-2 py-1 text-sm tabular-nums text-slate-900 outline-none placeholder:text-slate-400 focus:bg-slate-50 focus:ring-2 focus:ring-inset focus:ring-slate-300"
          />
        ),
      },
      {
        key: '_factor',
        header: 'Factor',
        kind: 'custom',
        thClassName: 'w-28',
        tdClassName: 'text-right',
        render: ({ row }) => {
          const f = computeFactor(row?.a_qty, row?.b_qty)
          return <div className="px-2 text-sm tabular-nums text-slate-700">{f === null ? '—' : f.toFixed(2)}</div>
        },
      },
    ],
    [],
  )

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="presentation" onMouseDown={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-xl bg-white shadow-lg"
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div>
            <div className="text-base font-semibold text-slate-900">Unit conversions</div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-600">
              <span className=" px-2 py-0.5 text-sm font-bold text-dark-red text-lg text-uppercase">
                {ingredientMeta?.name.toUpperCase() ?? ingredient?.name.toUpperCase() ?? `Ingredient #${ingredientId}`}:
              </span>
              {ingredientMeta?.category_name ? (
                <span className="rounded-md border border-slate-200 bg-white px-2 py-0.5">
                  Category: <span className="font-medium text-slate-900">{ingredientMeta.category_name}</span>
                </span>
              ) : null}
              {ingredientMeta?.unit ? (
                <span className="rounded-md border border-slate-200 bg-white px-2 py-0.5">
                  Unit: <span className="font-medium text-slate-900">{ingredientMeta.unit}</span>
                </span>
              ) : null}
              {ingredientMeta?.base_price !== null && ingredientMeta?.base_price !== undefined ? (
                <span className="rounded-md border border-slate-200 bg-white px-2 py-0.5">
                  Price: <span className="font-medium text-slate-900 tabular-nums">{ingredientMeta.base_price} INR</span> 
                </span>
              ) : null}
              {ingredientMeta?.item_code !== null && ingredientMeta?.item_code !== undefined ? (
                <span className="rounded-md border border-slate-200 bg-white px-2 py-0.5">
                  Code: <span className="font-medium text-slate-900 tabular-nums">{ingredientMeta.item_code}</span>
                </span>
              ) : null}
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3 p-4">
          {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div> : null}

          <LineItemsGrid
            rows={rows}
            onRowsChange={setRows}
            createRow={newRow}
            columns={columns}
            minRows={1}
            showRowActions
            rowActionsHeader="Rows"
            getRowClassName={(row) => {
              if (row?._status === 'success') return 'bg-green-50'
              if (row?._status === 'failed') return 'bg-red-50'
              return ''
            }}
          />

          <div className="flex items-center justify-end gap-2">
            <Button variant="secondary" type="button" onClick={onClose} disabled={saving}>
              Close
            </Button>
            <Button
              variant="primary"
              type="button"
              disabled={saving || loading || !Number.isFinite(ingredientId)}
              onClick={async () => {
                if (saving || loading || !Number.isFinite(ingredientId)) return
                setError('')
                setSaving(true)
                try {
                  setRows((prev) => prev.map((r) => ({ ...r, _status: '', _error: '' })))

                  const items = rows
                    .map((r, idx) => {
                      const from_unit = normalizeUnit(r.a_unit)
                      const to_unit = normalizeUnit(r.b_unit)
                      const factor = computeFactor(r.a_qty, r.b_qty)
                      const conversion_id = Number(r.conversion_id)

                      if (!from_unit || !to_unit || factor === null) return null

                      if (Number.isFinite(conversion_id) && conversion_id > 0) {
                        return { __row: idx + 1, id: conversion_id, from_unit, to_unit, factor }
                      }
                      return { __row: idx + 1, from_unit, to_unit, factor }
                    })
                    .filter(Boolean)

                  const resp = await upsertIngredientUnitConversions(ingredientId, { items })
                  const failures = Array.isArray(resp?.failures) ? resp.failures : []
                  const failedRows = new Map(
                    failures.filter((f) => Number.isFinite(Number(f?.row))).map((f) => [Number(f.row), String(f?.error ?? 'Failed')]),
                  )

                  setRows((prev) =>
                    prev.map((r, idx) => {
                      const rowNum = idx + 1
                      const errMsg = failedRows.get(rowNum)
                      if (errMsg) return { ...r, _status: 'failed', _error: errMsg }
                      // If row is incomplete, keep neutral.
                      const from_unit = normalizeUnit(r.a_unit)
                      const to_unit = normalizeUnit(r.b_unit)
                      const factor = computeFactor(r.a_qty, r.b_qty)
                      if (!from_unit || !to_unit || factor === null) return { ...r, _status: '', _error: '' }
                      return { ...r, _status: 'success', _error: '' }
                    }),
                  )
                } catch (e) {
                  setError(e?.response?.data?.message || e?.message || 'Failed to save conversions')
                } finally {
                  setSaving(false)
                }
              }}
            >
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>

          {loading ? <div className="text-sm text-slate-500">Loading…</div> : null}
        </div>
      </div>
    </div>
  )
}

