import { useCallback, useEffect, useMemo, useState } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import { Breadcrumb } from '../../../components/Breadcrumb.jsx'
import { Button } from '../../../components/Button.jsx'
import { DataTable } from '../../../components/DataTable.jsx'
import { MultiSelect } from '../../../components/MultiSelect.jsx'
import { listIngredients } from '../../../apis/ingredient.js'
import { listStocks } from '../../../apis/stock.js'
import { OriginsProvider, useOrigins } from '../../../context/OriginsContext.jsx'
import { StockAdjustModal } from './StockAdjustModal.jsx'

function formatQtyWithUnit(qty, unit) {
  const n = Number(qty)
  const u = unit != null ? String(unit).trim() : ''
  if (!Number.isFinite(n)) return '—'
  const qtyStr = n % 1 === 0 ? String(n) : String(n)
  return u ? `${qtyStr} ${u}` : qtyStr
}

function formatOriginBreakdown(origins) {
  if (!Array.isArray(origins) || !origins.length) return null
  return origins
    .map((o) => {
      const name = o?.origin_name != null ? String(o.origin_name).trim() : ''
      const qty = formatQtyWithUnit(o?.qty, o?.unit)
      return name ? `${name}: ${qty}` : qty
    })
    .join(' · ')
}

function StockPageInner() {
  const { options: originOptions, error: originsError } = useOrigins()

  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [selectedOriginIds, setSelectedOriginIds] = useState(() => /** @type {string[]} */ ([]))
  const [selectedIngredientIds, setSelectedIngredientIds] = useState(() => /** @type {string[]} */ ([]))
  const [ingredientFilterOptions, setIngredientFilterOptions] = useState(() => /** @type {{ value: string, label: string }[]} */ ([]))
  const [adjustOpen, setAdjustOpen] = useState(false)

  useEffect(() => {
    let alive = true
    ;(async () => {
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
        setIngredientFilterOptions(opts)
      } catch {
        if (alive) setIngredientFilterOptions([])
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  const reload = useCallback(async () => {
    setError('')
    setLoading(true)
    try {
      const origin_ids = selectedOriginIds.length ? selectedOriginIds.map(Number) : undefined
      const ingredient_ids = selectedIngredientIds.length ? selectedIngredientIds.map(Number) : undefined
      const { items, pagination } = await listStocks({
        page,
        limit: pageSize,
        q: search.trim() || undefined,
        ...(origin_ids?.length ? { origin_ids } : {}),
        ...(ingredient_ids?.length ? { ingredient_ids } : {}),
      })
      setRows(Array.isArray(items) ? items : [])
      setTotal(typeof pagination?.total === 'number' ? pagination.total : 0)
    } catch (e) {
      setRows([])
      setTotal(0)
      setError(e?.response?.data?.message || e?.response?.data?.error || e?.message || 'Failed to load stock')
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, search, selectedOriginIds.join(','), selectedIngredientIds.join(',')])

  useEffect(() => {
    let alive = true
    void (async () => {
      if (!alive) return
      await reload()
    })()
    return () => {
      alive = false
    }
  }, [reload])

  useEffect(() => {
    if (!originsError) return
    setError((prev) => prev || originsError || 'Could not load origins for filters.')
  }, [originsError])

  const columns = useMemo(
    () => [
      {
        key: 'item_code',
        header: 'Item code',
        className: 'w-[120px]',
        render: (r) => <span className="tabular-nums">{r.item_code ?? '—'}</span>,
      },
      { key: 'ingredient_name', header: 'Ingredient' },
      { key: 'category_name', header: 'Category', className: 'w-[140px]', render: (r) => r.category_name ?? '—' },
      {
        key: 'current_qty',
        header: 'Current stock',
        className: 'w-[160px]',
        render: (r) => {
          const main = formatQtyWithUnit(r.current_qty, r.unit)
          const breakdown = formatOriginBreakdown(r.origins)
          if (!breakdown) return <span className="tabular-nums font-medium text-slate-900">{main}</span>
          return (
            <div className="tabular-nums">
              <div className="font-medium text-slate-900">{main}</div>
              <div className="mt-0.5 text-xs text-slate-500" title={breakdown}>
                {breakdown}
              </div>
            </div>
          )
        },
      },
      { key: 'unit', header: 'Unit', className: 'w-[80px]', render: (r) => r.unit ?? '—' },
    ],
    [],
  )

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Breadcrumb items={[{ label: 'Inventory' }, { label: 'Stock' }]} />
        <Button variant="primary" type="button" onClick={() => setAdjustOpen(true)}>
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
          Adjust stock
        </Button>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
      ) : null}

      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(r) => r.ingredient_id}
        manualPagination
        page={page}
        pageSize={pageSize}
        total={total}
        search={search}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        onSearchChange={(v) => {
          setSearch(v)
          setPage(1)
        }}
        searchPlaceholder="Search ingredients…"
        emptyText={loading ? 'Loading…' : 'No stock records found'}
        renderFilters={() => (
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-full sm:w-[280px]">
              <MultiSelect
                options={originOptions}
                value={selectedOriginIds}
                onChange={(next) => {
                  setSelectedOriginIds(next)
                  setPage(1)
                }}
                placeholder="All origins…"
              />
            </div>
            <div className="w-full sm:w-[280px]">
              <MultiSelect
                options={ingredientFilterOptions}
                value={selectedIngredientIds}
                onChange={(next) => {
                  setSelectedIngredientIds(next)
                  setPage(1)
                }}
                placeholder="All ingredients…"
              />
            </div>
          </div>
        )}
      />

      <StockAdjustModal open={adjustOpen} onClose={() => setAdjustOpen(false)} />
    </section>
  )
}

export function StockPage() {
  return (
    <OriginsProvider>
      <StockPageInner />
    </OriginsProvider>
  )
}
