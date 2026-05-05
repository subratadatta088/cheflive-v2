import { useEffect, useMemo, useState } from 'react'
import { Breadcrumb } from '../../components/Breadcrumb.jsx'
import { Button } from '../../components/Button.jsx'
import { DataTable } from '../../components/DataTable.jsx'
import { AddCategoryModal } from '../../components/AddCategoryModal.jsx'
import { EditCategoryModal } from '../../components/EditCategoryModal.jsx'
import { ConfirmModal } from '../../components/ConfirmModal.jsx'
import { PlusCircle, Pencil, Trash2 } from 'lucide-react'
import { createCategory, deleteCategoryById, listCategories, updateCategoryById } from '../../apis/category.js'
import { Switch } from '../../components/Switch.jsx'
import { DateTime } from '../../components/DateTime.jsx'

function toBoolActive(v) {
  return v === true || v === 1 || v === '1'
}

function isDeletedRow(r) {
  return Boolean(r?.deleted_at)
}

export function InventoryCategoriesPage() {
  const [rows, setRows] = useState(() => [])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [addOpen, setAddOpen] = useState(false)
  const [edit, setEdit] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const refresh = async () => {
    setError('')
    setLoading(true)
    try {
      const data = await listCategories({ page: 1, limit: 50 })
      setRows(Array.isArray(data?.items) ? data.items : [])
    } catch (e) {
      setRows([])
      setError(e?.response?.data?.message || e?.message || 'Failed to load categories')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const columns = useMemo(
    () => [
      {
        key: 'name',
        header: 'Category',
        render: (r) => <span className={isDeletedRow(r) ? 'text-slate-400' : 'text-slate-900'}>{r.name}</span>,
      },
      {
        key: 'is_active',
        header: 'Status',
        className: 'w-[160px]',
        render: (r) => {
          if (isDeletedRow(r)) return <span className="text-sm text-slate-400">—</span>
          const active = toBoolActive(r.is_active)
          return (
            <Switch
              checked={active}
              aria-label={active ? 'Active' : 'Inactive'}
              onChange={async (next) => {
                setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, is_active: next ? 1 : 0 } : x)))
                try {
                  await updateCategoryById(r.id, { is_active: next })
                } catch (e) {
                  // revert on failure
                  setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, is_active: active ? 1 : 0 } : x)))
                  setError(e?.response?.data?.message || e?.message || 'Failed to update status')
                }
              }}
            />
          )
        },
      },
      {
        key: 'updated_at',
        header: 'Updated',
        className: 'w-[200px]',
        render: (r) => (
          <DateTime value={r.updated_at} age className={isDeletedRow(r) ? 'opacity-60' : ''} />
        ),
      },
      {
        key: 'actions',
        header: 'Actions',
        className: 'w-[140px]',
        render: (r) =>
          isDeletedRow(r) ? (
            <div className="text-sm text-slate-500">
              <span className="mr-2">Deleted</span>
              <DateTime value={r.deleted_at} age />
            </div>
          ) : (
          <div className="flex items-center gap-2">
            <button
              type="button"
              title="Edit"
              onClick={() => setEdit({ id: r.id, name: r.name, is_active: toBoolActive(r.is_active) })}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            >
              <Pencil className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              title="Delete"
              onClick={async () => {
                setDeleteTarget({ id: r.id, name: r.name })
              }}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-red-700 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          ),
      },
    ],
    [],
  )

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Breadcrumb items={[{ label: 'Inventory' }, { label: 'Categories' }]} />
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" type="button" onClick={() => setAddOpen(true)}>
            <PlusCircle className="h-4 w-4" aria-hidden="true" />
            Add category
          </Button>
        </div>
      </div>

      {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div> : null}

      <DataTable
        columns={columns}
        rows={rows}
        searchPlaceholder="Search categories…"
        emptyText={loading ? 'Loading…' : 'No categories found'}
      />

      <AddCategoryModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreate={async (name) => {
          await createCategory({ name, is_active: true })
          await refresh()
        }}
      />

      <EditCategoryModal
        open={Boolean(edit)}
        onClose={() => setEdit(null)}
        initialName={edit?.name ?? ''}
        initialIsActive={Boolean(edit?.is_active)}
        onSave={async (payload) => {
          await updateCategoryById(edit.id, payload)
          await refresh()
        }}
      />

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Delete category"
        description={deleteTarget ? `Delete category "${deleteTarget.name}"? This cannot be undone.` : ''}
        confirmText={isDeleting ? 'Deleting…' : 'Delete'}
        confirmVariant="danger"
        onCancel={() => {
          if (isDeleting) return
          setDeleteTarget(null)
        }}
        onConfirm={async () => {
          if (!deleteTarget || isDeleting) return
          setError('')
          setIsDeleting(true)
          try {
            await deleteCategoryById(deleteTarget.id)
            setDeleteTarget(null)
            await refresh()
          } catch (e) {
            setError(e?.response?.data?.message || e?.message || 'Failed to delete category')
          } finally {
            setIsDeleting(false)
          }
        }}
        isConfirmDisabled={isDeleting}
      />
    </section>
  )
}

