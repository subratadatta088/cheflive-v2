import { Breadcrumb } from '../../../components/Breadcrumb.jsx'
import { Button } from '../../../components/Button.jsx'
import { DataTable } from '../../../components/DataTable.jsx'
import { PlusCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export function InventoryPreparationsPage() {
  const navigate = useNavigate()

  const rows = [
    { name: 'Tomato sauce base', category: 'Sauce', unit: 'kg', stock: 15.0, updatedAt: '2026-05-01' },
    { name: 'Chicken stock', category: 'Stock', unit: 'L', stock: 22.5, updatedAt: '2026-05-01' },
    { name: 'Marinade mix', category: 'Marinade', unit: 'kg', stock: 8.2, updatedAt: '2026-04-30' },
    { name: 'Pizza dough', category: 'Dough', unit: 'kg', stock: 30.0, updatedAt: '2026-04-30' },
    { name: 'Caesar dressing', category: 'Dressing', unit: 'L', stock: 4.1, updatedAt: '2026-04-29' },
    { name: 'Curry paste', category: 'Other', unit: 'kg', stock: 6.8, updatedAt: '2026-04-29' },
  ]

  const columns = [
    { key: 'name', header: 'Preparation' },
    { key: 'category', header: 'Category' },
    { key: 'unit', header: 'Unit', className: 'w-[90px]' },
    {
      key: 'stock',
      header: 'Stock',
      className: 'w-[110px]',
      render: (r) => (
        <span className="tabular-nums">
          {r.stock} {r.unit}
        </span>
      ),
    },
    { key: 'updatedAt', header: 'Updated', className: 'w-[140px]' },
  ]

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Breadcrumb items={[{ label: 'Inventory' }, { label: 'Preparations' }]} />
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={() => navigate('/inventory/preparations/create')}>
            <PlusCircle className="h-4 w-4" aria-hidden="true" />
            Create
          </Button>
        </div>
      </div>
      <DataTable
        columns={columns}
        rows={rows}
        searchPlaceholder="Search preparations…"
        emptyText="No preparations found"
      />
    </section>
  )
}
