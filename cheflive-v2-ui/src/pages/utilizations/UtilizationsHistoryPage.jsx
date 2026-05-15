import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Info, PanelRightOpen, PlusCircle, Trash2 } from 'lucide-react'
import { Breadcrumb } from '../../components/Breadcrumb.jsx'
import { Button } from '../../components/Button.jsx'
import { ConfirmModal } from '../../components/ConfirmModal.jsx'
import { DataTable } from '../../components/DataTable.jsx'
import { DateTime } from '../../components/DateTime.jsx'
import { deleteUtilizationById, listUtilizations } from '../../apis/utilization.js'
import { useToast } from '../../components/Toaster.jsx'
import { SplitDetailPanel } from '../../components/SplitDetailPanel.jsx'
import { OriginsProvider, useOrigins } from '../../context/OriginsContext.jsx'

function formatUtilizationDate(value) {
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

function truncateNote(note, max = 56) {
  const t = note === null || note === undefined ? '' : String(note).trim()
  if (!t) return '—'
  if (t.length <= max) return t
  return `${t.slice(0, max)}…`
}

function formatQtyDisplay(n) {
  if (!Number.isFinite(n)) return '—'
  return n % 1 === 0 ? String(n) : n.toFixed(3).replace(/\.?0+$/, '')
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

function originNameById(origins) {
  const map = {}
  for (const o of origins) {
    const id = Number(o?.id)
    if (!Number.isFinite(id) || id <= 0) continue
    const name = o?.name != null ? String(o.name).trim() : ''
    map[String(id)] = name || `Origin #${id}`
  }
  return map
}

function UtilizationItemsTable({ items }) {
  if (!Array.isArray(items) || items.length === 0) {
    return <p className="text-sm text-slate-600">No line items.</p>
  }
  return (
    <table className="w-full min-w-[420px] border-collapse text-sm">
      <thead>
        <tr className="border-b border-slate-200 text-left text-xs font-bold uppercase tracking-wide text-slate-700">
          <th className="pb-2 pe-3">Ingredient</th>
          <th className="w-24 pb-2 pe-3 text-right">Qty</th>
          <th className="w-24 pb-2">Unit</th>
        </tr>
      </thead>
      <tbody>
        {items.map((it) => (
          <tr key={it.id ?? `${it.ingredient_id}-${it.qty}`} className="border-b border-slate-100">
            <td className="py-2 pe-3 text-slate-900">
              <div className="font-medium">
                {it.ingredient_name != null && String(it.ingredient_name).trim() !== ''
                  ? String(it.ingredient_name).trim()
                  : 'Unknown ingredient'}
              </div>
              {it.ingredient_id != null ? (
                <div className="text-xs tabular-nums text-slate-500">#{it.ingredient_id}</div>
              ) : null}
            </td>
            <td className="py-2 pe-3 text-right tabular-nums">{formatQtyDisplay(Number(it.qty))}</td>
            <td className="py-2 text-slate-700">
              {it.unit != null && String(it.unit).trim() !== '' ? String(it.unit) : '—'}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function UtilizationsHistoryInnerPage() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { origins: originOptions, error: originsError } = useOrigins()
  const originNames = useMemo(() => originNameById(originOptions), [originOptions])

  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [originFilter, setOriginFilter] = useState('')

  const [openMenuForId, setOpenMenuForId] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [viewItemsUtilization, setViewItemsUtilization] = useState(null)
  const [selectedRowIds, setSelectedRowIds] = useState([])
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)

  useEffect(() => {
    if (!originsError) return
    showToast({
      theme: 'failure',
      duration: 6000,
      text: originsError || 'Could not load origins for filters.',
    })
  }, [originsError, showToast])

  useEffect(() => {
    if (selectedRowIds.length === 0 && bulkDeleteOpen) setBulkDeleteOpen(false)
  }, [selectedRowIds.length, bulkDeleteOpen])

  const reload = useCallback(async () => {
    setError('')
    setLoading(true)
    try {
      const origin_id = originFilter.trim() === '' ? undefined : Number(originFilter)
      const { items, raw } = await listUtilizations({
        page,
        limit: pageSize,
        q: search.trim() || undefined,
        ...(Number.isFinite(origin_id) && origin_id > 0 ? { origin_id } : {}),
      })
      const list = Array.isArray(items) ? items : []
      setRows(list)
      const nextTotal =
        typeof raw?.pagination?.total === 'number'
          ? raw.pagination.total
          : typeof raw?.total === 'number'
            ? raw.total
            : (page - 1) * pageSize + list.length
      setTotal(nextTotal)
    } catch (e) {
      setRows([])
      setTotal(0)
      setError(e?.response?.data?.message || e?.response?.data?.error || e?.message || 'Failed to load utilizations')
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, search, originFilter])

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
        header: 'Date',
        className: 'w-[130px]',
        render: (r) => <span className="tabular-nums">{formatUtilizationDate(r.date)}</span>,
      },
      {
        key: 'origin',
        header: 'Origin',
        render: (r) => {
          const oid = Number(r?.origin_id)
          if (!Number.isFinite(oid) || oid <= 0) return '—'
          const name = r?.origin_name || originNames[String(oid)]
          return <span>{name || 'Unknown origin'}</span>
        },
      },
      {
        key: 'preparation',
        header: 'Preparation',
        render: (r) => {
          const name =
            r?.preparation_name != null && String(r.preparation_name).trim() !== ''
              ? String(r.preparation_name).trim()
              : ''
          if (name) return <span>{name}</span>
          const pid = Number(r?.preparation_id)
          if (Number.isFinite(pid) && pid > 0) return <span className="text-slate-500">#{pid}</span>
          return '—'
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
                  setViewItemsUtilization(r)
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
          const uid = Number(r?.id)
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
                      if (Number.isFinite(uid)) navigate(`/utilizations/${uid}/edit`)
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
    [navigate, openMenuForId, originNames],
  )

  const panelOpen = Boolean(viewItemsUtilization)

  return (
    <section className="flex w-full flex-col gap-0 lg:flex-row lg:items-stretch">
      <div className={'min-w-0 flex-1 space-y-4' + (panelOpen ? ' px-2' : '')}>
        <div className="my-2 flex flex-wrap items-center justify-between gap-3">
          <Breadcrumb items={[{ label: 'Utilizations' }, { label: 'History' }]} />
          <div className="flex flex-wrap items-center gap-2">
            {selectedRowIds.length > 0 ? (
              <>
                <span className="inline-flex items-center gap-1.5 text-sm text-slate-600">
                  <Info className="h-4 w-4 shrink-0 text-red-900" strokeWidth={2.75} aria-hidden="true" />
                  <span className="tabular-nums">{selectedRowIds.length} selected</span>
                </span>
                <Button variant="danger" type="button" onClick={() => setBulkDeleteOpen(true)}>
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  Delete
                </Button>
              </>
            ) : null}
            <Button variant="secondary" type="button" onClick={() => navigate('/utilizations/create')}>
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
          emptyText={loading ? 'Loading…' : 'No utilizations found'}
          renderFilters={() => (
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
          )}
          rowSelection={{
            selectedIds: selectedRowIds,
            onChange: setSelectedRowIds,
          }}
        />

        <ConfirmModal
          open={bulkDeleteOpen}
          title="Delete selected utilizations?"
          description={
            selectedRowIds.length === 1
              ? 'This will delete 1 utilization (soft delete).'
              : `This will delete ${selectedRowIds.length} utilizations (soft delete).`
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
            for (const uid of ids) {
              try {
                await deleteUtilizationById(uid)
                succeeded.push(uid)
              } catch (e) {
                lastErr = e?.response?.data?.error || e?.response?.data?.message || e?.message || 'Delete failed'
              }
            }
            setSelectedRowIds((prev) => prev.filter((id) => !succeeded.includes(Number(id))))
            await reload()
            if (succeeded.length === ids.length) {
              showToast({
                text: succeeded.length === 1 ? 'Utilization deleted.' : `${succeeded.length} utilizations deleted.`,
                theme: 'success',
                duration: 4000,
              })
            } else {
              showToast({
                theme: 'failure',
                duration: 6000,
                text: lastErr || `Deleted ${succeeded.length} of ${ids.length}.`,
              })
            }
          }}
        />

        <ConfirmModal
          open={Boolean(deleteTarget)}
          title="Delete utilization?"
          description={
            deleteTarget
              ? `Utilization #${deleteTarget.id} will be deleted (soft delete).`
              : ''
          }
          confirmText="Delete"
          confirmVariant="danger"
          onCancel={() => setDeleteTarget(null)}
          onConfirm={async () => {
            if (!deleteTarget) return
            const uid = Number(deleteTarget.id)
            setDeleteTarget(null)
            if (!Number.isFinite(uid)) return
            try {
              await deleteUtilizationById(uid)
              showToast({ text: 'Utilization deleted.', theme: 'success', duration: 4000 })
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
        onClose={() => setViewItemsUtilization(null)}
        title={viewItemsUtilization ? <>Utilization #{viewItemsUtilization.id} — line items</> : null}
      >
        {viewItemsUtilization ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm shadow-sm">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:divide-x sm:divide-slate-200">
                <div className="min-w-0 sm:pe-4">
                  <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Date</div>
                  <div className="mt-0.5 font-medium text-slate-900">
                    {formatUtilizationDate(viewItemsUtilization.date)}
                  </div>
                </div>
                <div className="min-w-0 sm:ps-4">
                  <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Origin</div>
                  <div className="mt-0.5 truncate font-medium text-slate-900">
                    {(() => {
                      const oid = Number(viewItemsUtilization.origin_id)
                      if (!Number.isFinite(oid) || oid <= 0) return '—'
                      return (
                        viewItemsUtilization.origin_name || originNames[String(oid)] || 'Unknown origin'
                      )
                    })()}
                  </div>
                </div>
              </div>
            </div>
            <UtilizationItemsTable
              items={Array.isArray(viewItemsUtilization.items) ? viewItemsUtilization.items : []}
            />
          </div>
        ) : null}
      </SplitDetailPanel>
    </section>
  )
}

export function UtilizationsHistoryPage() {
  return (
    <OriginsProvider>
      <UtilizationsHistoryInnerPage />
    </OriginsProvider>
  )
}
