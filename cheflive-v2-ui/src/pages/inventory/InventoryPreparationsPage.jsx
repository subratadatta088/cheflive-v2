import { Breadcrumb } from '../../components/Breadcrumb.jsx'

export function InventoryPreparationsPage() {
  return (
    <section className="space-y-4">
      <Breadcrumb items={[{ label: 'Inventory' }, { label: 'Preparations' }]} />
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-base font-semibold text-slate-900">Preparations</h2>
        <p className="mt-1 text-sm text-slate-600">Inventory preparations screen (placeholder).</p>
      </div>
    </section>
  )
}

