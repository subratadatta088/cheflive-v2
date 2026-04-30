import { useState } from 'react'
import { Breadcrumb } from '../../components/Breadcrumb.jsx'
import { Button } from '../../components/Button.jsx'
import { useNavigate } from 'react-router-dom'

export function InventoryIngredientCreatePage() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [category, setCategory] = useState('Dry')
  const [unit, setUnit] = useState('kg')
  const [openingStock, setOpeningStock] = useState('')

  return (
    <section className="flex  flex-col gap-4 ">
      <Breadcrumb items={[{ label: 'Inventory' }, { label: 'Ingredients' }, { label: 'Create' }]} />

      <div className="flex-1 max-w-2xl py-16">
        <h2 className="text-base font-semibold text-slate-900">Create ingredient</h2>

        <form
          className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault()
            // mock submit for now
            alert(`Created: ${name} (${category})`)
          }}
        >
          <label className="space-y-1 sm:col-span-2">
            <div className="text-sm font-medium text-slate-700">Name</div>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-300"
              placeholder="e.g. Basmati rice"
              required
            />
          </label>

          <label className="space-y-1">
            <div className="text-sm font-medium text-slate-700">Category</div>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-300"
            >
              <option>Dry</option>
              <option>Dairy</option>
              <option>Meat</option>
              <option>Veg</option>
              <option>Spice</option>
              <option>Frozen</option>
            </select>
          </label>

          <label className="space-y-1">
            <div className="text-sm font-medium text-slate-700">Unit</div>
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-300"
            >
              <option value="kg">kg</option>
              <option value="g">g</option>
              <option value="L">L</option>
              <option value="ml">ml</option>
              <option value="pcs">pcs</option>
            </select>
          </label>

          <label className="space-y-1">
            <div className="text-sm font-medium text-slate-700">Opening stock</div>
            <input
              inputMode="decimal"
              value={openingStock}
              onChange={(e) => setOpeningStock(e.target.value)}
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-300"
              placeholder={`0 ${unit}`}
            />
          </label>
        </form>
      </div>

      <div className="max-w-2xl">
        <div className="mx-auto flex items-center justify-end  gap-2">
          <Button variant="secondary" type="button" onClick={() => navigate('/inventory/ingredients')}>
            Cancel
          </Button>
          <Button variant="primary" type="button" onClick={() => alert(`Created: ${name} (${category})`)} disabled={!name.trim()}>
            Save
          </Button>
        </div>
      </div>
    </section>
  )
}

