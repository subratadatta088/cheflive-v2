import { Breadcrumb } from '../../components/Breadcrumb.jsx'

export function UtilizationsCreatePage() {
  return (
    <section className="space-y-4">
      <Breadcrumb items={[{ label: 'Utilizations' }, { label: 'Create' }]} />
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-base font-semibold text-slate-900">Create utilization</h2>
        <p className="mt-1 text-sm text-slate-600">Utilization creation screen (placeholder).</p>
      </div>
    </section>
  )
}

