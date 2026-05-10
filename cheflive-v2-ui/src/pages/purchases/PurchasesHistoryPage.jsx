import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PanelRightOpen, PlusCircle } from 'lucide-react'
import { Breadcrumb } from '../../components/Breadcrumb.jsx'
import { Button } from '../../components/Button.jsx'
import { ConfirmModal } from '../../components/ConfirmModal.jsx'
import { DataTable } from '../../components/DataTable.jsx'
import { DateTime } from '../../components/DateTime.jsx'
import { deletePurchaseById, listPurchases } from '../../apis/purchase.js'
import { listOrigins } from '../../apis/origin.js'
import { useToast } from '../../components/Toaster.jsx'
import { SplitDetailPanel } from '../../components/SplitDetailPanel.jsx'

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

export function PurchasesHistoryPage() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [rows, setRows] = useState(() => [])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [originFilter, setOriginFilter] = useState('')
  const [originOptions, setOriginOptions] = useState(() => /** @type {{ id: number, name: string }[]} */ ([]))

  const [openMenuForId, setOpenMenuForId] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [viewItemsPurchase, setViewItemsPurchase] = useState(null)

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
    let cancelled = false
    ;(async () => {
      try {
        const { items } = await listOrigins({ limit: 200, is_active: true })
        if (cancelled) return
        const opts = []
        for (const o of items) {
          const id = Number(o?.id)
          if (!Number.isFinite(id) || id <= 0) continue
          const nameRaw = o?.name != null ? String(o.name).trim() : ''
          opts.push({ id, name: nameRaw || `Origin #${id}` })
        }
        setOriginOptions(opts.sort((a, b) => a.name.localeCompare(b.name)))
      } catch (e) {
        if (!cancelled) {
          console.error('[Origins load failed]', e)
          showToast({
            theme: 'failure',
            duration: 6000,
            text: e?.response?.data?.message || e?.message || 'Could not load origins for filter.',
          })
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [showToast])

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

  return (
    <section className="flex w-full flex-col gap-0 lg:flex-row lg:items-stretch">
      <div
        className={'min-w-0 flex-1 space-y-4' + (viewItemsPurchase ? ' px-2' : '')}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 my-2">
          <Breadcrumb items={[{ label: 'Purchases' }, { label: 'History' }]} />
          <Button variant="secondary" type="button" onClick={() => navigate('/purchases/create')}>
            <PlusCircle className="h-4 w-4" aria-hidden="true" />
            Create
          </Button>
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
        open={Boolean(viewItemsPurchase)}
        onClose={() => setViewItemsPurchase(null)}
        title={viewItemsPurchase ? <>Purchase #{viewItemsPurchase.id} — line items</> : null}
      >
        {viewItemsPurchase ? (
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

            {Array.isArray(viewItemsPurchase.items) && viewItemsPurchase.items.length > 0 ? (
              <table className="w-full min-w-[520px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-600">
                    <th className="pb-2 pe-3 font-medium">Ingredient</th>
                    <th className="w-24 pb-2 pe-3 text-right font-medium">Qty</th>
                    <th className="w-24 pb-2 pe-3 font-medium">Unit</th>
                    <th className="w-28 pb-2 pe-3 text-right font-medium">Unit price</th>
                    <th className="w-28 pb-2 text-right font-medium">Line total</th>
                  </tr>
                </thead>
                <tbody>
                  {viewItemsPurchase.items.map((it) => {
                    const ext = lineExtended(it)
                    const nameRaw =
                      it.ingredient_name != null && String(it.ingredient_name).trim() !== ''
                        ? String(it.ingredient_name).trim()
                        : ''
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
                        <td className="py-2 pe-3 text-right tabular-nums">
                          {it.unit_price != null && Number.isFinite(Number(it.unit_price))
                            ? formatMoney(Number(it.unit_price))
                            : '—'}
                        </td>
                        <td className="py-2 text-right tabular-nums text-slate-900">
                          {ext !== null ? formatMoney(ext) : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            ) : (
              <p className="text-sm text-slate-600">No line items.</p>
            )}
          </div>
        ) : null}
      </SplitDetailPanel>
    </section>
  )
}
