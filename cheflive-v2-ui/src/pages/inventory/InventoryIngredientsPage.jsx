import { Breadcrumb } from '../../components/Breadcrumb.jsx'
import { Button } from '../../components/Button.jsx'
import { DataTable } from '../../components/DataTable.jsx'
import { PlusCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export function InventoryIngredientsPage() {
  const navigate = useNavigate()

  const rows = [
    { name: 'Basmati rice', category: 'Dry', unit: 'kg', stock: 42.5, updatedAt: '2026-05-01' },
    { name: 'Olive oil', category: 'Dry', unit: 'L', stock: 12.1, updatedAt: '2026-05-01' },
    { name: 'Butter', category: 'Dairy', unit: 'kg', stock: 8.4, updatedAt: '2026-04-30' },
    { name: 'Chicken breast', category: 'Meat', unit: 'kg', stock: 18.0, updatedAt: '2026-04-30' },
    { name: 'Tomato puree', category: 'Veg', unit: 'kg', stock: 6.2, updatedAt: '2026-04-29' },
    { name: 'Black pepper', category: 'Spice', unit: 'kg', stock: 3.1, updatedAt: '2026-04-29' },
  ]

  const columns = [
    { key: 'name', header: 'Ingredient' },
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
      <div className="flex items-center justify-between gap-3">
        <Breadcrumb items={[{ label: 'Inventory' }, { label: 'Ingredients' }]} />
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
      <DataTable
        columns={columns}
        rows={rows}
        searchPlaceholder="Search ingredients…"
        emptyText="No ingredients found"
      />
    </section>
  )
}

