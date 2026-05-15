import { useCallback, useEffect, useMemo, useState } from 'react'
import { Breadcrumb } from '../../../components/Breadcrumb.jsx'
import { DataTable } from '../../../components/DataTable.jsx'
import { CreatePreparationButton } from '../../../components/CreatePreparationButton.jsx'
import { EditPreparationModal } from '../../../components/EditPreparationModal.jsx'
import { ConfirmModal } from '../../../components/ConfirmModal.jsx'
import { DateTime } from '../../../components/DateTime.jsx'
import { Switch } from '../../../components/Switch.jsx'
import { TableRowActionsMenu } from '../../../components/TableRowActionsMenu.jsx'
import { deletePreparationById, listPreparations, updatePreparation } from '../../../apis/preparation.js'
import { formatTagsForInput } from './preparationFormUtils.js'

function ingredientCount(row) {
  const items = Array.isArray(row?.items) ? row.items : []
  return items.length
}

export function InventoryPreparationsPage() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [openMenuForId, setOpenMenuForId] = useState(null)
  const [editId, setEditId] = useState(null)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteRow, setDeleteRow] = useState(null)
  const [activeSavingIds, setActiveSavingIds] = useState(() => /** @type {number[]} */ ([]))

  const reload = useCallback(async () => {
    setError('')
    setLoading(true)
    try {
      const data = await listPreparations({
        page,
        limit: pageSize,
        q: search.trim() || undefined,
      })
      const items = Array.isArray(data?.items) ? data.items : []
      setRows(items)
      const nextTotal =
        typeof data?.raw?.total === 'number'
          ? data.raw.total
          : items.length < pageSize
            ? (page - 1) * pageSize + items.length
            : page * pageSize + 1
      setTotal(nextTotal)
    } catch (e) {
      setRows([])
      setTotal(0)
      setError(e?.response?.data?.error || e?.message || 'Failed to load preparations.')
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, search])

  useEffect(() => {
    void reload()
  }, [reload])

  const columns = useMemo(
    () => [
      { key: 'name', header: 'Preparation' },
      { key: 'type', header: 'Type', className: 'w-[120px]' },
      { key: 'unit', header: 'Unit', className: 'w-[90px]' },
      {
        key: 'ingredients',
        header: 'Ingredients',
        className: 'w-[110px]',
        render: (r) => <span className="tabular-nums">{ingredientCount(r)}</span>,
      },
      {
        key: 'tags',
        header: 'Tags',
        className: 'min-w-[140px]',
        render: (r) => {
          const t = formatTagsForInput(r?.tags)
          return t ? <span className="text-slate-700">{t}</span> : <span className="text-slate-400">—</span>
        },
      },
      {
        key: 'is_active',
        header: 'Active',
        className: 'w-[90px]',
        cellClassName: 'text-center',
        render: (r) => {
          const id = Number(r?.id)
          const checked = r?.is_active === true || r?.is_active === 1 || String(r?.is_active) === '1'
          const saving = Number.isFinite(id) && activeSavingIds.includes(id)
          return (
            <div className="flex items-center justify-center">
              <Switch
                checked={checked}
                disabled={!Number.isFinite(id) || saving}
                aria-label={`Set ${String(r?.name ?? 'preparation')} active`}
                onChange={async (next) => {
                  if (!Number.isFinite(id)) return
                  setError('')
                  setRows((prev) =>
                    prev.map((x) => (Number(x?.id) === id ? { ...x, is_active: next ? 1 : 0 } : x)),
                  )
                  setActiveSavingIds((prev) => (prev.includes(id) ? prev : [...prev, id]))
                  try {
                    await updatePreparation(id, { preparation: { is_active: Boolean(next) } })
                  } catch (e) {
                    setRows((prev) =>
                      prev.map((x) => (Number(x?.id) === id ? { ...x, is_active: checked ? 1 : 0 } : x)),
                    )
                    setError(e?.response?.data?.error || e?.message || 'Failed to update active status.')
                  } finally {
                    setActiveSavingIds((prev) => prev.filter((x) => x !== id))
                  }
                }}
              />
            </div>
          )
        },
      },
      {
        key: 'updated_at',
        header: 'Updated',
        className: 'w-[140px]',
        render: (r) => <DateTime value={r?.updated_at || r?.created_at} age />,
      },
      {
        key: '__actions',
        header: '',
        className: 'w-[60px]',
        cellClassName: 'text-right',
        render: (r) => {
          const open = openMenuForId === r.id
          return (
            <TableRowActionsMenu
              open={open}
              onOpenChange={(next) => setOpenMenuForId(next ? r.id : null)}
              menuClassName="w-36"
            >
              <button
                type="button"
                role="menuitem"
                className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                onClick={() => {
                  setOpenMenuForId(null)
                  setEditId(r.id)
                  setEditOpen(true)
                }}
              >
                Edit
              </button>
              <button
                type="button"
                role="menuitem"
                className="block w-full px-3 py-2 text-left text-sm text-red-700 hover:bg-red-50"
                onClick={() => {
                  setOpenMenuForId(null)
                  setDeleteRow(r)
                }}
              >
                Delete
              </button>
            </TableRowActionsMenu>
          )
        },
      },
    ],
    [openMenuForId, activeSavingIds],
  )

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Breadcrumb items={[{ label: 'Inventory' }, { label: 'Preparations' }]} />
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <CreatePreparationButton onCreated={() => void reload()} />
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
        onSearchChange={setSearch}
        searchPlaceholder="Search preparations…"
        emptyText={loading ? 'Loading…' : 'No preparations found'}
      />

      <EditPreparationModal
        open={editOpen}
        preparationId={editId}
        onClose={() => {
          setEditOpen(false)
          setEditId(null)
        }}
        onUpdated={() => {
          void reload()
        }}
      />

      <ConfirmModal
        open={Boolean(deleteRow)}
        title="Delete preparation?"
        description={deleteRow ? `This will delete “${deleteRow.name}”.` : 'Are you sure?'}
        confirmText="Delete"
        confirmVariant="danger"
        onCancel={() => setDeleteRow(null)}
        onConfirm={async () => {
          if (!deleteRow) return
          const id = deleteRow.id
          try {
            await deletePreparationById(id)
            setDeleteRow(null)
            await reload()
          } catch (e) {
            setError(e?.response?.data?.error || e?.message || 'Failed to delete preparation.')
            setDeleteRow(null)
          }
        }}
      />
    </section>
  )
}
