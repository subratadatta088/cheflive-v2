import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Boxes, Info, List, PanelRightOpen, PlusCircle, Trash2 } from 'lucide-react'
import { Breadcrumb } from '../../components/Breadcrumb.jsx'
import { Button } from '../../components/Button.jsx'
import { ConfirmModal } from '../../components/ConfirmModal.jsx'
import { DataTable } from '../../components/DataTable.jsx'
import { DateTime } from '../../components/DateTime.jsx'
import {
  deletePurchaseById,
  getAllPurchaseItems,
  getGroupedPurchaseItems,
  listPurchases,
} from '../../apis/purchase.js'
import { useToast } from '../../components/Toaster.jsx'
import { ItemsPreviewSidePanel, moneySummaryValue } from '../../components/itemsPreview/ItemsPreviewSidePanel.jsx'
import { LineItemsPreviewTable } from '../../components/itemsPreview/LineItemsPreviewTable.jsx'
import { useItemsPreviewPanel } from '../../hooks/useItemsPreviewPanel.js'
import { formatMoney } from '../../utils/formatters.js'
import { normalizeSelectedIds } from '../../utils/selectionIds.js'
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
  const [selectedRowIds, setSelectedRowIds] = useState(() => /** @type {number[]} */ ([]))
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)

  const itemsPreview = useItemsPreviewPanel({
    fetchGrouped: getGroupedPurchaseItems,
    fetchFlat: getAllPurchaseItems,
    onError: (text) => showToast({ theme: 'failure', duration: 6000, text }),
  })

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
                  itemsPreview.openSingle(r)
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
    [navigate, openMenuForId, itemsPreview],
  )

  const pageSubtotalTotal = useMemo(() => {
    let sum = 0
    for (const r of rows) {
      const v = subtotalFromRow(r)
      if (Number.isFinite(v)) sum += v
    }
    return sum
  }, [rows])

  const { singleRecord, aggregateView, aggregateLoading, mode, panelOpen, close } = itemsPreview

  const panelTitle = (() => {
    if (aggregateLoading || aggregateView) {
      const prefix = mode === 'flat' ? 'All items' : 'Grouped items'
      const ids = Array.isArray(aggregateView?.purchase_ids) ? aggregateView.purchase_ids : []
      const found = Array.isArray(aggregateView?.found_purchase_ids) ? aggregateView.found_purchase_ids : []
      return (
        <>
          {prefix}
          {aggregateView ? (
            <span className="ms-2 text-sm font-normal text-slate-500">
              · {found.length}/{ids.length} {ids.length === 1 ? 'purchase' : 'purchases'}
            </span>
          ) : null}
        </>
      )
    }
    if (singleRecord) return <>Purchase #{singleRecord.id} — line items</>
    return null
  })()

  const aggregateSummaryFields = aggregateView
    ? [
        {
          label: mode === 'flat' ? 'Line items' : 'Ingredients',
          value: Array.isArray(aggregateView.items) ? aggregateView.items.length : 0,
        },
        {
          label: 'Subtotal',
          value: (
            <span className="font-semibold">{moneySummaryValue(aggregateView.subtotal)}</span>
          ),
        },
      ]
    : []

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
                <Button variant="secondary" type="button" onClick={() => itemsPreview.fetchGroupedView(selectedRowIds)}>
                  <Boxes className="h-4 w-4" aria-hidden="true" />
                  View grouped items
                </Button>
                <Button variant="secondary" type="button" onClick={() => itemsPreview.fetchFlatView(selectedRowIds)}>
                  <List className="h-4 w-4" aria-hidden="true" />
                  View all items
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

            <ItemsPreviewSidePanel
        open={panelOpen}
        onClose={close}
        title={panelTitle}
        loading={aggregateLoading}
        loadingMessage={
          mode === 'flat' ? 'Loading all items…' : mode === 'grouped' ? 'Loading grouped items…' : 'Loading items…'
        }
        summaryFields={
          singleRecord
            ? [
                {
                  label: 'Purchase date',
                  value: formatPurchaseDate(singleRecord.date),
                },
                {
                  label: 'Stored at',
                  value:
                    singleRecord.origin_name != null && String(singleRecord.origin_name).trim() !== ''
                      ? String(singleRecord.origin_name).trim()
                      : '—',
                },
                {
                  label: 'Line totals',
                  value: (
                    <span className="font-semibold">{moneySummaryValue(subtotalFromRow(singleRecord))}</span>
                  ),
                },
              ]
            : aggregateSummaryFields
        }
        missingIds={Array.isArray(aggregateView?.missing_ids) ? aggregateView.missing_ids : []}
        entityLabel="purchase"
      >
        {singleRecord ? (
          <LineItemsPreviewTable
            items={Array.isArray(singleRecord.items) ? singleRecord.items : []}
            variant="purchase-single"
          />
        ) : aggregateView ? (
          <LineItemsPreviewTable
            items={Array.isArray(aggregateView.items) ? aggregateView.items : []}
            variant={mode === 'flat' ? 'purchase-flat' : 'purchase-grouped'}
          />
        ) : null}
      </ItemsPreviewSidePanel>
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
