import { useEffect, useMemo, useState } from 'react'
import { Breadcrumb } from '../../../components/Breadcrumb.jsx'
import { Button } from '../../../components/Button.jsx'
import { DataTable } from '../../../components/DataTable.jsx'
import { Download, Info, PlusCircle, Trash2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import {
  deleteIngredientById,
  getIngredientById,
  listIngredients,
  updateIngredientById,
} from '../../../apis/ingredient.js'
import { DateTime } from '../../../components/DateTime.jsx'
import { ConfirmModal } from '../../../components/ConfirmModal.jsx'

function csvEscape(cell) {
  const s = cell === null || cell === undefined ? '' : String(cell)
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function formatTagsForCsv(tags) {
  if (!tags) return ''
  if (Array.isArray(tags)) return tags.map((t) => String(t)).join('|')
  return String(tags)
}

/** @param {Array<Record<string, unknown>>} rows */
function ingredientsToCsv(rows) {
  const headers = ['id', 'category_id', 'category_name', 'name', 'unit', 'base_price', 'tags', 'is_active', 'updated_at']
  const lines = [headers.join(',')]
  for (const r of rows) {
    const base =
      r.base_price === null || r.base_price === undefined ? '' : String(r.base_price)
    const active = r.is_active === true || r.is_active === 1 || String(r.is_active) === '1'
    lines.push(
      [
        csvEscape(r.id),
        csvEscape(r.category_id),
        csvEscape(r.category_name ?? ''),
        csvEscape(r.name ?? ''),
        csvEscape(r.unit ?? ''),
        csvEscape(base),
        csvEscape(formatTagsForCsv(r.tags)),
        csvEscape(active ? '1' : '0'),
        csvEscape(r.updated_at ?? ''),
      ].join(','),
    )
  }
  return lines.join('\r\n')
}

export function InventoryIngredientsPage() {
  const navigate = useNavigate()

  const [rows, setRows] = useState(() => [])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [openMenuForId, setOpenMenuForId] = useState(null)
  const [editRow, setEditRow] = useState(null)
  const [editForm, setEditForm] = useState(() => ({ name: '', unit: '', base_price: '' }))
  const [deleteRow, setDeleteRow] = useState(null)
  const [selectedRowIds, setSelectedRowIds] = useState(() => [])
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [exportingCsv, setExportingCsv] = useState(false)

  const columns = useMemo(
    () => [
    { key: 'name', header: 'Ingredient' },
    { key: 'category_name', header: 'Category' },
    { key: 'unit', header: 'Unit', className: 'w-[90px]' },
    {
      key: 'base_price',
      header: 'Base price',
      className: 'w-[110px]',
      render: (r) => <span className="tabular-nums">{r.base_price ?? '—'}</span>,
    },
    { key: 'updated_at', header: 'Updated', className: 'w-[140px]', render: (r) => <DateTime value={r.updated_at} age /> },
    {
      key: '__actions',
      header: '',
      className: 'w-[60px]',
      cellClassName: 'text-right',
      render: (r) => {
        const open = openMenuForId === r.id
        return (
          <div className="relative inline-block text-left">
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              onClick={(e) => {
                e.stopPropagation()
                setOpenMenuForId((cur) => (cur === r.id ? null : r.id))
              }}
              aria-label="Row actions"
            >
              ⋮
            </button>
            {open ? (
              <div
                className="absolute right-0 z-20 mt-1 w-36 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg"
                onMouseDown={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                  onClick={() => {
                    setOpenMenuForId(null)
                    setEditRow(r)
                    setEditForm({
                      name: String(r?.name ?? ''),
                      unit: String(r?.unit ?? ''),
                      base_price: r?.base_price === null || r?.base_price === undefined ? '' : String(r.base_price),
                    })
                  }}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="block w-full px-3 py-2 text-left text-sm text-red-700 hover:bg-red-50"
                  onClick={() => {
                    setOpenMenuForId(null)
                    setDeleteRow(r)
                  }}
                >
                  Delete
                </button>
              </div>
            ) : null}
          </div>
        )
      },
    },
  ],
    [openMenuForId],
  )

  async function reload() {
    setError('')
    setLoading(true)
    try {
      const data = await listIngredients({ page, limit: pageSize, q: search.trim() || undefined })
      const items = Array.isArray(data?.items) ? data.items : []
      setRows(items)
      const nextTotal =
        typeof data?.pagination?.total === 'number'
          ? data.pagination.total
          : typeof data?.raw?.total === 'number'
            ? data.raw.total
            : (page - 1) * pageSize + items.length
      setTotal(nextTotal)
    } catch (e) {
      setRows([])
      setTotal(0)
      setError(e?.response?.data?.message || e?.message || 'Failed to load ingredients')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        if (!alive) return
        await reload()
      } catch (e) {
        // reload handles errors
      }
    })()
    return () => {
      alive = false
    }
  }, [page, pageSize, search])

  useEffect(() => {
    if (selectedRowIds.length === 0 && bulkDeleteOpen) setBulkDeleteOpen(false)
  }, [selectedRowIds.length, bulkDeleteOpen])

  useEffect(() => {
    const close = () => setOpenMenuForId(null)
    window.addEventListener('mousedown', close)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('mousedown', close)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [])

  async function exportIngredientsCsv() {
    setError('')
    setExportingCsv(true)
    try {
      const seen = new Set()
      const ids = []
      for (const raw of selectedRowIds) {
        const n = Number(raw)
        if (!Number.isFinite(n) || seen.has(n)) continue
        seen.add(n)
        ids.push(n)
      }
      if (ids.length === 0) return

      const loaded = await Promise.all(
        ids.map(async (id) => {
          try {
            const data = await getIngredientById(id)
            return data?.ingredient ?? null
          } catch {
            return null
          }
        }),
      )
      const all = loaded.filter(Boolean)
      if (all.length === 0) {
        setError('Could not load selected ingredients for export.')
        return
      }
      if (all.length < ids.length) {
        setError(`Exported ${all.length} of ${ids.length} selected rows. Some could not be loaded.`)
      }
      const csv = ingredientsToCsv(all)
      const blob = new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `ingredients-export-${new Date().toISOString().slice(0, 10)}.csv`
      a.rel = 'noopener'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (e) {
      setError(e?.response?.data?.message || e?.message || 'Failed to export CSV')
    } finally {
      setExportingCsv(false)
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Breadcrumb items={[{ label: 'Inventory' }, { label: 'Ingredients' }]} />
        <div className="flex flex-wrap items-center gap-2">
          {selectedRowIds.length > 0 ? (
            <>
              <span
                className="inline-flex items-center gap-1.5 text-sm text-slate-600"
                title={`${selectedRowIds.length} row${selectedRowIds.length === 1 ? '' : 's'} selected`}
              >
                <Info className="h-4 w-4 shrink-0 text-red-900" strokeWidth={2.75} aria-hidden="true" />
                <span className="tabular-nums">
                  <span className="sr-only">Selected rows: </span>
                  {selectedRowIds.length} selected
                </span>
              </span>
              <Button variant="danger" onClick={() => setBulkDeleteOpen(true)}>
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Delete
              </Button>
              <Button variant="secondary" disabled={exportingCsv} onClick={() => void exportIngredientsCsv()}>
                <Download className="h-4 w-4" aria-hidden="true" />
                {exportingCsv ? 'Exporting…' : 'Export CSV'}
              </Button>
            </>
          ) : null}
          <Button
            variant="secondary"
            onClick={() => {
              navigate('/inventory/ingredients/create')
            }}
          >
            <PlusCircle className="h-4 w-4" aria-hidden="true" />
            Create
          </Button>
        </div>
      </div>

      {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div> : null}
      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(r) => r.id}
        manualPagination
        page={page}
        pageSize={pageSize}
        total={total}
        search={search}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        onSearchChange={setSearch}
        searchPlaceholder="Search ingredients…"
        emptyText={loading ? 'Loading…' : 'No ingredients found'}
        rowSelection={{
          selectedIds: selectedRowIds,
          onChange: setSelectedRowIds,
        }}
      />

      {/* Edit modal (simple) */}
      {editRow ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="presentation" onMouseDown={() => setEditRow(null)}>
          <div className="w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-lg" onMouseDown={(e) => e.stopPropagation()}>
            <div className="border-b border-slate-200 px-4 py-3">
              <div className="text-base font-semibold text-slate-900">Edit ingredient</div>
              <div className="text-sm text-slate-600">{editRow?.name}</div>
            </div>
            <div className="space-y-3 p-4">
              <label className="block">
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-600">Name</div>
                <input
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-300"
                  value={editForm.name}
                  onChange={(e) => setEditForm((s) => ({ ...s, name: e.target.value }))}
                />
              </label>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block">
                  <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-600">Unit</div>
                  <input
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-300"
                    value={editForm.unit}
                    onChange={(e) => setEditForm((s) => ({ ...s, unit: e.target.value }))}
                  />
                </label>
                <label className="block">
                  <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-600">Base price</div>
                  <input
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-300"
                    value={editForm.base_price}
                    onChange={(e) => setEditForm((s) => ({ ...s, base_price: e.target.value }))}
                    inputMode="decimal"
                  />
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="secondary" type="button" onClick={() => setEditRow(null)}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  type="button"
                  onClick={async () => {
                    try {
                      const payload = {
                        name: editForm.name.trim() || undefined,
                        unit: editForm.unit.trim() || undefined,
                        base_price:
                          editForm.base_price.trim() === ''
                            ? null
                            : Number.isFinite(Number(editForm.base_price))
                              ? Number(editForm.base_price)
                              : undefined,
                      }
                      await updateIngredientById(editRow.id, payload)
                      setEditRow(null)
                      await reload()
                    } catch (e) {
                      setError(e?.response?.data?.message || e?.message || 'Failed to update ingredient')
                      setEditRow(null)
                    }
                  }}
                >
                  Save
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmModal
        open={Boolean(deleteRow)}
        title="Delete ingredient?"
        description={deleteRow ? `This will delete “${deleteRow.name}”.` : 'Are you sure?'}
        confirmText="Delete"
        confirmVariant="danger"
        onCancel={() => setDeleteRow(null)}
        onConfirm={async () => {
          if (!deleteRow) return
          const id = deleteRow.id
          try {
            await deleteIngredientById(id)
            setDeleteRow(null)
            setSelectedRowIds((prev) => prev.filter((x) => Number(x) !== Number(id)))
            await reload()
          } catch (e) {
            setError(e?.response?.data?.message || e?.message || 'Failed to delete ingredient')
            setDeleteRow(null)
          }
        }}
      />

      <ConfirmModal
        open={bulkDeleteOpen}
        title="Delete selected ingredients?"
        description={
          selectedRowIds.length === 1
            ? 'This will delete 1 ingredient. This cannot be undone.'
            : `This will delete ${selectedRowIds.length} ingredients. This cannot be undone.`
        }
        confirmText="Delete all"
        confirmVariant="danger"
        onCancel={() => setBulkDeleteOpen(false)}
        onConfirm={async () => {
          const ids = [...selectedRowIds]
          setBulkDeleteOpen(false)
          if (ids.length === 0) return
          const succeeded = []
          let lastErr = ''
          for (const id of ids) {
            try {
              await deleteIngredientById(id)
              succeeded.push(id)
            } catch (e) {
              lastErr = e?.response?.data?.message || e?.message || 'Delete failed'
            }
          }
          setSelectedRowIds((prev) => prev.filter((id) => !succeeded.includes(id)))
          await reload()
          if (succeeded.length < ids.length) {
            setError(lastErr || `Deleted ${succeeded.length} of ${ids.length}. Some could not be deleted.`)
          } else {
            setError('')
          }
        }}
      />
    </section>
  )
}

