import { Breadcrumb } from '../../components/Breadcrumb.jsx'

export function TransfersCreatePage() {
  return (
    <section className="space-y-4">
      <Breadcrumb items={[{ label: 'Transfers' }, { label: 'Create' }]} />
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-base font-semibold text-slate-900">Create transfer</h2>
        <p className="mt-1 text-sm text-slate-600">Transfer creation screen (placeholder).</p>
      </div>
    </section>
  )
}

