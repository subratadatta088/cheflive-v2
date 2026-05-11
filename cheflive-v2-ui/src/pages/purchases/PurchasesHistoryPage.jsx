import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Boxes, Info, PanelRightOpen, PlusCircle, Trash2 } from 'lucide-react'
import { Breadcrumb } from '../../components/Breadcrumb.jsx'
import { Button } from '../../components/Button.jsx'
import { ConfirmModal } from '../../components/ConfirmModal.jsx'
import { DataTable } from '../../components/DataTable.jsx'
import { DateTime } from '../../components/DateTime.jsx'
import { deletePurchaseById, getGroupedPurchaseItems, listPurchases } from '../../apis/purchase.js'
import { useToast } from '../../components/Toaster.jsx'
import { SplitDetailPanel } from '../../components/SplitDetailPanel.jsx'
import { OriginsProvider, useOrigins } from '../../context/OriginsContext.jsx'

/** @param {unknown} value */
function formatPurchaseDate(value) {
  if (value === null || value === undefined) return '—'
  const s = String(value).trim()
  if (!s) return '—'
  const day = s.length >= 10 ? s.slice(0, 10) : s
  const d = new Date(`${day}T12:00:00`)
  if (!Number.isFinite(d.getTime())) return day
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  }).format(d)
}

/** @param {unknown} note @param {number} [max] */
function truncateNote(note, max = 56) {
  const t = note === null || note === undefined ? '' : String(note).trim()
  if (!t) return '—'
  if (t.length <= max) return t
  return `${t.slice(0, max)}…`
}

/** @param {unknown} row */
function subtotalFromRow(row) {
  const direct = row?.subtotal
  if (direct !== undefined && direct !== null && Number.isFinite(Number(direct))) return Number(direct)
  const items = Array.isArray(row?.items) ? row.items : []
  let sum = 0
  for (const it of items) {
    const q = Number(it?.qty)
    const raw = it?.unit_price
    const price =
      raw === null || raw === undefined || raw === '' ? NaN : Number(raw)
    if (Number.isFinite(q) && Number.isFinite(price)) sum += q * price
  }
  return sum
}

function formatQtyDisplay(n) {
  if (!Number.isFinite(n)) return '—'
  return n % 1 === 0 ? String(n) : n.toFixed(3).replace(/\.?0+$/, '')
}

function formatMoney(n) {
  if (!Number.isFinite(n)) return '—'
  return n.toFixed(2)
}

/** @param {unknown} it */
function lineExtended(it) {
  const q = Number(it?.qty)
  const raw = it?.unit_price
  const price =
    raw === null || raw === undefined || raw === '' ? NaN : Number(raw)
  if (!Number.isFinite(q) || !Number.isFinite(price)) return null
  return q * price
}

function normalizeSelectedIds(selectedRowIds) {
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

/**
 * Shared items table used by both the single-purchase view and the grouped view.
 *
 * - Single mode (`variant="single"`): items come from `GET /purchases/:id`. Each row has
 *   its own `unit_price` and the line total is computed as `qty × unit_price`.
 * - Grouped mode (`variant="grouped"`): items come from `POST /purchases/grouped-items`.
 *   `unit_price` is intentionally absent (prices vary across days), so the column is hidden
 *   and the line total is the backend-supplied per-ingredient `subtotal`.
 *
 * @param {{
 *   items: Array<Record<string, unknown>>,
 *   variant?: 'single' | 'grouped',
 * }} props
 */
function PurchaseItemsTable({ items, variant = 'single' }) {
  if (!Array.isArray(items) || items.length === 0) {
    return <p className="text-sm text-slate-600">No line items.</p>
  }
  const grouped = variant === 'grouped'
  return (
    <table className="w-full min-w-[520px] border-collapse text-sm">
      <thead>
        <tr className="border-b border-slate-200 text-left text-xs font-bold uppercase tracking-wide text-slate-700">
          <th className="pb-2 pe-3">Ingredient</th>
          <th className="w-24 pb-2 pe-3 text-right">Qty</th>
          <th className="w-24 pb-2 pe-3">Unit</th>
          {grouped ? null : <th className="w-28 pb-2 pe-3 text-right">Unit price</th>}
          <th className="w-28 pb-2 text-right">{grouped ? 'Subtotal' : 'Line total'}</th>
        </tr>
      </thead>
      <tbody>
        {items.map((it) => {
          const nameRaw =
            it.ingredient_name != null && String(it.ingredient_name).trim() !== ''
              ? String(it.ingredient_name).trim()
              : ''
          let lineTotal
          if (grouped) {
            const raw = it?.subtotal
            const n = raw === null || raw === undefined || raw === '' ? NaN : Number(raw)
            lineTotal = Number.isFinite(n) ? n : null
          } else {
            lineTotal = lineExtended(it)
          }
          return (
            <tr key={it.id ?? `${it.ingredient_id}-${it.qty}`} className="border-b border-slate-100">
              <td className="py-2 pe-3 text-slate-900">
                <div className="font-medium">{nameRaw || 'Unknown ingredient'}</div>
                {it.ingredient_id != null ? (
                  <div className="text-xs tabular-nums text-slate-500">#{it.ingredient_id}</div>
                ) : null}
              </td>
              <td className="py-2 pe-3 text-right tabular-nums">{formatQtyDisplay(Number(it.qty))}</td>
              <td className="py-2 pe-3 text-slate-700">
                {it.unit != null && String(it.unit).trim() !== '' ? String(it.unit) : '—'}
              </td>
              {grouped ? null : (
                <td className="py-2 pe-3 text-right tabular-nums">
                  {it.unit_price != null && Number.isFinite(Number(it.unit_price))
                    ? formatMoney(Number(it.unit_price))
                    : '—'}
                </td>
              )}
              <td className="py-2 text-right tabular-nums text-slate-900">
                {lineTotal !== null ? formatMoney(lineTotal) : '—'}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function PurchasesHistoryInnerPage() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { origins: originOptions, error: originsError } = useOrigins()

  const [rows, setRows] = useState(() => [])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [originFilter, setOriginFilter] = useState('')

  const [openMenuForId, setOpenMenuForId] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [viewItemsPurchase, setViewItemsPurchase] = useState(null)
  const [selectedRowIds, setSelectedRowIds] = useState(() => /** @type {number[]} */ ([]))
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [groupedItemsView, setGroupedItemsView] = useState(
    () =>
      /** @type {null | {
       *   purchase_ids: number[],
       *   found_purchase_ids: number[],
       *   missing_ids: number[],
       *   items: Array<Record<string, unknown>>,
       *   subtotal: number,
       * }} */ (null),
  )
  const [groupedItemsLoading, setGroupedItemsLoading] = useState(false)

  useEffect(() => {
    if (!originsError) return
    showToast({
      theme: 'failure',
      duration: 6000,
      text: originsError || 'Could not load origins for filter.',
    })
  }, [originsError, showToast])

  useEffect(() => {
    if (selectedRowIds.length === 0 && bulkDeleteOpen) setBulkDeleteOpen(false)
  }, [selectedRowIds.length, bulkDeleteOpen])

  const handleViewGroupedItems = useCallback(async () => {
    const ids = normalizeSelectedIds(selectedRowIds)
    if (ids.length === 0) return
    setViewItemsPurchase(null)
    setGroupedItemsLoading(true)
    try {
      const data = await getGroupedPurchaseItems({ ids })
      setGroupedItemsView(data)
    } catch (e) {
      setGroupedItemsView(null)
      showToast({
        theme: 'failure',
        duration: 6000,
        text: e?.response?.data?.error || e?.response?.data?.message || e?.message || 'Could not load grouped items.',
      })
    } finally {
      setGroupedItemsLoading(false)
    }
  }, [selectedRowIds, showToast])

  const reload = useCallback(async () => {
    setError('')
    setLoading(true)
    try {
      const origin_id =
        originFilter.trim() === '' ? undefined : Number(originFilter)
      const data = await listPurchases({
        page,
        limit: pageSize,
        q: search.trim() || undefined,
        ...(Number.isFinite(origin_id) && origin_id > 0 ? { origin_id } : {}),
      })
      const items = Array.isArray(data?.items) ? data.items : []
      setRows(items)
      const nextTotal =
        typeof data?.pagination?.total === 'number'
          ? data.pagination.total
          : typeof data?.total === 'number'
            ? data.total
            : (page - 1) * pageSize + items.length
      setTotal(nextTotal)
    } catch (e) {
      setRows([])
      setTotal(0)
      setError(e?.response?.data?.message || e?.response?.data?.error || e?.message || 'Failed to load purchases')
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, search, originFilter])

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        if (!alive) return
        await reload()
      } catch {
        // reload handles errors
      }
    })()
    return () => {
      alive = false
    }
  }, [reload])

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

  const columns = useMemo(
    () => [
      {
        key: 'id',
        header: 'ID',
        className: 'w-[72px]',
        render: (r) => <span className="tabular-nums">{r.id ?? '—'}</span>,
      },
      {
        key: 'date',
        header: 'Purchase date',
        className: 'w-[130px]',
        render: (r) => <span className="tabular-nums">{formatPurchaseDate(r.date)}</span>,
      },
      {
        key: 'origin',
        header: 'Received at',
        render: (r) => {
          const raw = r?.origin_name != null ? String(r.origin_name).trim() : ''
          if (raw) return <span>{raw}</span>
          const oid = Number(r?.origin_id)
          return (
            <span className="text-slate-500" title={Number.isFinite(oid) ? `origin_id ${oid}` : undefined}>
              {Number.isFinite(oid) ? 'Unknown origin' : '—'}
            </span>
          )
        },
      },
      {
        key: 'items',
        header: 'Items',
        className: 'w-[104px]',
        cellClassName: 'text-center',
        render: (r) => {
          const n = Array.isArray(r?.items) ? r.items.length : 0
          return (
            <div className="flex items-center justify-center gap-1.5">
              <span className="tabular-nums">{n}</span>
              <button
                type="button"
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                onClick={(e) => {
                  e.stopPropagation()
                  setGroupedItemsView(null)
                  setGroupedItemsLoading(false)
                  setViewItemsPurchase(r)
                }}
                aria-label="Open line items"
              >
                <PanelRightOpen className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          )
        },
      },
      {
        key: 'subtotal',
        header: 'Subtotal',
        className: 'w-[100px]',
        cellClassName: 'text-right',
        render: (r) => <span className="tabular-nums">{formatMoney(subtotalFromRow(r))}</span>,
      },
      {
        key: 'note',
        header: 'Note',
        render: (r) => {
          const full = r?.note === null || r?.note === undefined ? '' : String(r.note)
          const short = truncateNote(r?.note, 56)
          if (short === '—') return short
          return (
            <span className="max-w-[min(28rem,55vw)] truncate block" title={full}>
              {short}
            </span>
          )
        },
      },
      {
        key: 'updated_at',
        header: 'Updated',
        className: 'w-[140px]',
        render: (r) => <DateTime value={r.updated_at} age />,
      },
      {
        key: '__actions',
        header: '',
        className: 'w-[56px]',
        cellClassName: 'text-right',
        render: (r) => {
          const open = openMenuForId === r.id
          const pid = Number(r?.id)
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
                  className="absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg"
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                    onClick={() => {
                      setOpenMenuForId(null)
                      if (Number.isFinite(pid)) navigate(`/purchases/${pid}/edit`)
                    }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="block w-full px-3 py-2 text-left text-sm text-red-700 hover:bg-red-50"
                    onClick={() => {
                      setOpenMenuForId(null)
                      setDeleteTarget(r)
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
    [navigate, openMenuForId],
  )

  const pageSubtotalTotal = useMemo(() => {
    let sum = 0
    for (const r of rows) {
      const v = subtotalFromRow(r)
      if (Number.isFinite(v)) sum += v
    }
    return sum
  }, [rows])

  const panelOpen = Boolean(viewItemsPurchase) || Boolean(groupedItemsView) || groupedItemsLoading

  return (
    <section className="flex w-full flex-col gap-0 lg:flex-row lg:items-stretch">
      <div
        className={'min-w-0 flex-1 space-y-4' + (panelOpen ? ' px-2' : '')}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 my-2">
          <Breadcrumb items={[{ label: 'Purchases' }, { label: 'History' }]} />
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
                <Button variant="secondary" type="button" onClick={handleViewGroupedItems}>
                  <Boxes className="h-4 w-4" aria-hidden="true" />
                  View grouped items
                </Button>
                <Button variant="danger" type="button" onClick={() => setBulkDeleteOpen(true)}>
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  Delete
                </Button>
              </>
            ) : null}
            <Button variant="secondary" type="button" onClick={() => navigate('/purchases/create')}>
              <PlusCircle className="h-4 w-4" aria-hidden="true" />
              Create
            </Button>
          </div>
        </div>

        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
        ) : null}

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
        onSearchChange={(v) => {
          setSearch(v)
          setPage(1)
        }}
        searchPlaceholder="Search notes…"
        emptyText={loading ? 'Loading…' : 'No purchases found'}
        renderFilters={() => (
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <label className="flex flex-col gap-1 text-sm text-slate-700">
              <span className="sr-only">Origin</span>
              <select
                className="h-10 min-w-[200px] rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-300"
                value={originFilter}
                onChange={(e) => {
                  setOriginFilter(e.target.value)
                  setPage(1)
                }}
                aria-label="Filter by origin"
              >
                <option value="">All origins</option>
                {originOptions.map((o) => (
                  <option key={o.id} value={String(o.id)}>
                    {o.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
        renderTableFooterCells={
          rows.length === 0
            ? undefined
            : () => (
                <>
                  {columns.map((col) =>
                    col.key === 'subtotal' ? (
                      <td
                        key={col.key}
                        className={`whitespace-nowrap border-t border-slate-200 px-2 py-2 text-right font-semibold tabular-nums text-slate-900 ${
                          col.className ?? ''
                        } ${col.cellClassName ?? ''}`}
                      >
                        {formatMoney(pageSubtotalTotal)}
                      </td>
                    ) : (
                      <td
                        key={col.key}
                        className={`whitespace-nowrap border-t border-slate-200 px-2 py-2 text-slate-600 ${col.className ?? ''} ${
                          col.cellClassName ?? ''
                        }`}
                      />
                    ),
                  )}
                </>
              )
        }
        rowSelection={{
          selectedIds: selectedRowIds,
          onChange: setSelectedRowIds,
        }}
        />

        <ConfirmModal
          open={bulkDeleteOpen}
          title="Delete selected purchases?"
          description={
            selectedRowIds.length === 1
              ? 'This will delete 1 purchase (soft delete). Stock-related effects depend on your backend rules.'
              : `This will delete ${selectedRowIds.length} purchases (soft delete). Stock-related effects depend on your backend rules.`
          }
          confirmText="Delete all"
          confirmVariant="danger"
          onCancel={() => setBulkDeleteOpen(false)}
          onConfirm={async () => {
            const ids = normalizeSelectedIds(selectedRowIds)
            setBulkDeleteOpen(false)
            if (ids.length === 0) return
            const succeeded = []
            let lastErr = ''
            for (const pid of ids) {
              try {
                await deletePurchaseById(pid)
                succeeded.push(pid)
              } catch (e) {
                lastErr = e?.response?.data?.error || e?.response?.data?.message || e?.message || 'Delete failed'
              }
            }
            setSelectedRowIds((prev) => prev.filter((pid) => !succeeded.includes(Number(pid))))
            await reload()
            if (succeeded.length === ids.length) {
              showToast({
                text:
                  succeeded.length === 1
                    ? 'Purchase deleted.'
                    : `${succeeded.length} purchases deleted.`,
                theme: 'success',
                duration: 4000,
              })
            } else {
              showToast({
                theme: 'failure',
                duration: 6000,
                text: lastErr || `Deleted ${succeeded.length} of ${ids.length}. Some could not be deleted.`,
              })
            }
          }}
        />

        <ConfirmModal
          open={Boolean(deleteTarget)}
          title="Delete purchase?"
          description={
            deleteTarget
              ? `Purchase #${deleteTarget.id} will be deleted (soft delete). Stock-related effects depend on your backend rules.`
              : ''
          }
          confirmText="Delete"
          confirmVariant="danger"
          onCancel={() => setDeleteTarget(null)}
          onConfirm={async () => {
            if (!deleteTarget) return
            const pid = Number(deleteTarget.id)
            setDeleteTarget(null)
            if (!Number.isFinite(pid)) return
            try {
              await deletePurchaseById(pid)
              showToast({ text: 'Purchase deleted.', theme: 'success', duration: 4000 })
              await reload()
            } catch (e) {
              showToast({
                theme: 'failure',
                duration: 6000,
                text: e?.response?.data?.error || e?.response?.data?.message || e?.message || 'Delete failed.',
              })
            }
          }}
        />
      </div>

      <SplitDetailPanel
        open={panelOpen}
        onClose={() => {
          setViewItemsPurchase(null)
          setGroupedItemsView(null)
          setGroupedItemsLoading(false)
        }}
        title={
          groupedItemsLoading || groupedItemsView ? (
            <>
              Grouped items
              {groupedItemsView ? (
                <span className="ms-2 text-sm font-normal text-slate-500">
                  · {groupedItemsView.found_purchase_ids.length}/{groupedItemsView.purchase_ids.length}{' '}
                  {groupedItemsView.purchase_ids.length === 1 ? 'purchase' : 'purchases'}
                </span>
              ) : null}
            </>
          ) : viewItemsPurchase ? (
            <>Purchase #{viewItemsPurchase.id} — line items</>
          ) : null
        }
      >
        {groupedItemsLoading ? (
          <p className="text-sm text-slate-600">Loading grouped items…</p>
        ) : groupedItemsView ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm shadow-sm">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:divide-x sm:divide-slate-200">
                <div className="min-w-0 sm:pe-4">
                  <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Ingredients</div>
                  <div className="mt-0.5 font-medium tabular-nums text-slate-900">
                    {groupedItemsView.items.length}
                  </div>
                </div>
                <div className="min-w-0 sm:ps-4">
                  <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Subtotal</div>
                  <div className="mt-0.5 font-semibold tabular-nums text-slate-900">
                    {formatMoney(Number(groupedItemsView.subtotal) || 0)}
                  </div>
                </div>
              </div>
            </div>

            {groupedItemsView.missing_ids.length > 0 ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                {groupedItemsView.missing_ids.length === 1
                  ? `1 selected purchase could not be loaded (#${groupedItemsView.missing_ids[0]}).`
                  : `${groupedItemsView.missing_ids.length} selected purchases could not be loaded: ${groupedItemsView.missing_ids
                      .map((pid) => `#${pid}`)
                      .join(', ')}.`}
              </div>
            ) : null}

            <PurchaseItemsTable items={groupedItemsView.items} variant="grouped" />
          </div>
        ) : viewItemsPurchase ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm shadow-sm">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:divide-x sm:divide-slate-200">
                <div className="min-w-0 sm:pe-4">
                  <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Purchase date</div>
                  <div className="mt-0.5 font-medium text-slate-900">{formatPurchaseDate(viewItemsPurchase.date)}</div>
                </div>
                <div className="min-w-0 sm:px-4">
                  <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Stored at</div>
                  <div
                    className="mt-0.5 truncate font-medium text-slate-900"
                    title={
                      viewItemsPurchase.origin_name != null ? String(viewItemsPurchase.origin_name).trim() : ''
                    }
                  >
                    {viewItemsPurchase.origin_name != null && String(viewItemsPurchase.origin_name).trim() !== ''
                      ? String(viewItemsPurchase.origin_name).trim()
                      : '—'}
                  </div>
                </div>
                <div className="min-w-0 sm:ps-4">
                  <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Line totals</div>
                  <div className="mt-0.5 font-semibold tabular-nums text-slate-900">
                    {formatMoney(subtotalFromRow(viewItemsPurchase))}
                  </div>
                </div>
              </div>
            </div>

            <PurchaseItemsTable items={Array.isArray(viewItemsPurchase.items) ? viewItemsPurchase.items : []} />
          </div>
        ) : null}
      </SplitDetailPanel>
    </section>
  )
}

export function PurchasesHistoryPage() {
  return (
    <OriginsProvider>
      <PurchasesHistoryInnerPage />
    </OriginsProvider>
  )
}
