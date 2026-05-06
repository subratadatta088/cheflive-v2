import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Breadcrumb } from '../../../components/Breadcrumb.jsx'
import { Button } from '../../../components/Button.jsx'
import { LineItemsGrid } from '../../../components/LineItemsGrid.jsx'
import { X } from 'lucide-react'
import { CategoriesProvider, useCategories } from '../../../context/CategoriesContext.jsx'
import { bulkUpdateIngredients, getIngredientsBulkByIds } from '../../../apis/ingredient.js'
import { useToast } from '../../../components/Toaster.jsx'
import { Switch } from '../../../components/Switch.jsx'
import { BackButton } from '../../../components/BackButton.jsx'

function normalizeUnitInput(v) {
  return String(v ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

function parseIdsFromLocation(location) {
  const params = new URLSearchParams(location?.search ?? '')
  const raw = params.get('ids') ?? ''
  const parts = raw
    .split(/[,\s]+/g)
    .map((s) => s.trim())
    .filter(Boolean)
  const out = []
  const seen = new Set()
  for (const p of parts) {
    const n = Number(p)
    if (!Number.isFinite(n) || n <= 0) continue
    if (seen.has(n)) continue
    seen.add(n)
    out.push(n)
  }
  return out
}

function ingredientToRow(ing) {
  const idNum = Number(ing?.id)
  const tags = Array.isArray(ing?.tags) ? ing.tags.join('|') : ing?.tags ? String(ing.tags) : ''
  const isActive =
    ing?.is_active === undefined || ing?.is_active === null
      ? '1'
      : ing.is_active === true || ing.is_active === 1 || String(ing.is_active) === '1'
        ? '1'
        : '0'

  return {
    id: Number.isFinite(idNum) ? String(idNum) : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    ingredient_id: Number.isFinite(idNum) ? idNum : null,
    name: String(ing?.name ?? ''),
    category_id: ing?.category_id === null || ing?.category_id === undefined ? '' : String(ing.category_id),
    unit: String(ing?.unit ?? 'kg') || 'kg',
    base_price: ing?.base_price === null || ing?.base_price === undefined ? '' : String(ing.base_price),
    tags,
    is_active: isActive,
    _status: '',
    _error: '',
  }
}

function InventoryIngredientBulkEditInnerPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { showToast } = useToast()
  const { options: categoryOptions } = useCategories()

  const ids = useMemo(() => parseIdsFromLocation(location), [location])

  const [rows, setRows] = useState(() => [])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const removeRow = (rowIndex) => {
    setRows((prev) => prev.filter((_, i) => i !== rowIndex))
  }

  const canSave = useMemo(() => {
    return rows.some(
      (r) =>
        Number.isFinite(Number(r?.ingredient_id)) &&
        String(r?.name ?? '').trim().length > 0 &&
        String(r?.category_id ?? '').trim().length > 0 &&
        String(r?.unit ?? '').trim().length > 0,
    )
  }, [rows])

  const columns = useMemo(
    () => [
      { key: 'name', header: 'Name', kind: 'text', placeholder: 'e.g. Basmati rice', thClassName: 'min-w-[220px]', align: 'left' },
      { key: 'category_id', header: 'Category', kind: 'select', options: categoryOptions, thClassName: 'w-40' },
      {
        key: 'unit',
        header: 'Unit',
        kind: 'custom',
        placeholder: 'e.g. kg',
        thClassName: 'w-28',
        align: 'left',
        render: ({ row, updateCell }) => (
          <input
            value={String(row?.unit ?? '')}
            onChange={(e) => updateCell('unit', normalizeUnitInput(e.target.value))}
            onBlur={(e) => updateCell('unit', normalizeUnitInput(e.target.value))}
            inputMode="text"
            autoComplete="off"
            spellCheck={false}
            placeholder="e.g. kg"
            className="box-border h-9 w-full min-w-[72px] border-0 bg-transparent px-2 py-1 text-sm tabular-nums text-slate-900 outline-none placeholder:text-slate-400 focus:bg-slate-50 focus:ring-2 focus:ring-inset focus:ring-slate-300"
          />
        ),
      },
      { key: 'base_price', header: 'Base price', kind: 'decimal', placeholder: '0', thClassName: 'w-36', align: 'right' },
      { key: 'tags', header: 'Tags', kind: 'text', placeholder: 'e.g. rice|grain', thClassName: 'min-w-[220px]', align: 'left' },
      {
        key: 'is_active',
        header: 'Active',
        kind: 'custom',
        thClassName: 'w-24',
        align: 'center',
        render: ({ row, updateCell }) => {
          const checked = String(row?.is_active ?? '1') === '1'
          return (
            <div className="flex items-center justify-center px-2">
              <Switch checked={checked} onChange={(v) => updateCell('is_active', v ? '1' : '0')} aria-label="Set active" />
            </div>
          )
        },
      },
      {
        key: '_remove',
        header: '',
        kind: 'custom',
        thClassName: 'w-12',
        tdClassName: 'text-center',
        render: ({ rowIndex }) => (
          <button
            type="button"
            title="Remove row"
            onClick={() => removeRow(rowIndex)}
            className="inline-flex h-8 w-8 items-center justify-center rounded border border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        ),
      },
    ],
    [categoryOptions],
  )

  async function load() {
    setError('')
    if (!ids.length) {
      setRows([])
      setError('No ids provided. Use /inventory/ingredients/edit?ids=1,2,3')
      return
    }

    setLoading(true)
    try {
      const data = await getIngredientsBulkByIds(ids)
      const items = Array.isArray(data?.items) ? data.items : []
      setRows(items.map(ingredientToRow))
      showToast({
        text: `Loaded ${items.length} ingredient${items.length === 1 ? '' : 's'} for editing.`,
        theme: 'success',
        duration: 6000,
      })
    } catch (e) {
      setRows([])
      setError(e?.response?.data?.message || e?.message || 'Failed to load ingredients')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids.join(',')])

  useEffect(() => {
    if (!categoryOptions?.length) return
    setRows((prev) =>
      prev.map((r) => ({
        ...r,
        category_id: r.category_id ? r.category_id : categoryOptions[0].value,
      })),
    )
  }, [categoryOptions])

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Breadcrumb items={[{ label: 'Inventory' }, { label: 'Ingredients' }, { label: 'Edit' }]} />
        <div className="flex flex-wrap items-center gap-2">
          <BackButton to="/inventory/ingredients" />
          <Button variant="secondary" type="button" disabled={loading || saving} onClick={() => void load()}>
            {loading ? 'Loading…' : 'Reload'}
          </Button>
        </div>
      </div>

      <div className="flex-1 py-4">
        <h2 className="text-base font-semibold text-slate-900">Edit ingredients</h2>
        <div className="mt-2 text-sm text-slate-600">
          {ids.length ? (
            <span className="tabular-nums">{ids.length} selected id{ids.length === 1 ? '' : 's'}</span>
          ) : (
            'No ids provided'
          )}
        </div>

        <div className="mt-4">
          <LineItemsGrid
            rows={rows}
            onRowsChange={setRows}
            createRow={() => ingredientToRow({})}
            columns={columns}
            showRowActions={false}
            minRows={0}
            showIndexColumn
            getRowClassName={(row) => {
              if (row?._status === 'success') return 'bg-green-50'
              if (row?._status === 'failed') return 'bg-red-50'
              return ''
            }}
          />
        </div>
      </div>

      <div className="flex w-full items-center justify-end gap-2">
        <Button
          variant="primary"
          type="button"
          disabled={!canSave || saving || loading}
          onClick={async () => {
            if (!canSave || saving || loading) return
            setError('')
            setSaving(true)
            try {
              setRows((prev) => prev.map((r) => ({ ...r, _status: '', _error: '' })))

              const normalized = rows
                .map((r, idx) => {
                  const ingredient_id = Number(r.ingredient_id)
                  if (!Number.isFinite(ingredient_id)) return null

                  const name = String(r.name ?? '').trim()
                  const category_id = Number(r.category_id)
                  const unit = String(r.unit ?? '').trim() || 'kg'
                  const base_price_raw = String(r.base_price ?? '').trim()
                  const tags_raw = String(r.tags ?? '').trim()
                  const is_active = String(r.is_active ?? '1') === '1'

                  const base_price =
                    base_price_raw === ''
                      ? null
                      : Number.isFinite(Number(base_price_raw))
                        ? Number(base_price_raw)
                        : null

                  const tags =
                    tags_raw === ''
                      ? null
                      : tags_raw
                          .split(/[,\|]/g)
                          .map((s) => s.trim())
                          .filter(Boolean)

                  return {
                    __row: idx + 1,
                    id: ingredient_id,
                    name,
                    category_id,
                    unit,
                    base_price,
                    tags,
                    is_active,
                  }
                })
                .filter(Boolean)

              const resp = await bulkUpdateIngredients({ items: normalized })
              const failures = Array.isArray(resp?.failures) ? resp.failures : []
              const failedRows = new Map(
                failures
                  .filter((f) => Number.isFinite(Number(f?.row)))
                  .map((f) => [Number(f.row), String(f?.error ?? 'Failed')]),
              )

              setRows((prev) =>
                prev.map((r, idx) => {
                  const rowNum = idx + 1
                  const errMsg = failedRows.get(rowNum)
                  if (errMsg) return { ...r, _status: 'failed', _error: errMsg }
                  if (!String(r?.name ?? '').trim()) return { ...r, _status: '', _error: '' }
                  return { ...r, _status: 'success', _error: '' }
                }),
              )

              const anyFailed = failedRows.size > 0
              if (!anyFailed) {
                showToast({ text: 'Saved changes.', theme: 'success', duration: 5000 })
                navigate('/inventory/ingredients')
              } else {
                showToast({ text: 'Some rows failed. Review highlighted rows.', theme: 'warning', duration: 8000 })
              }
            } catch (e) {
              setError(e?.response?.data?.message || e?.message || 'Failed to save changes')
            } finally {
              setSaving(false)
            }
          }}
        >
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </div>

      {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div> : null}
    </section>
  )
}

export function InventoryIngredientBulkEditPage() {
  return (
    <CategoriesProvider>
      <InventoryIngredientBulkEditInnerPage />
    </CategoriesProvider>
  )
}

