import { Breadcrumb } from '../../components/Breadcrumb.jsx'

export function ReportUsagePage() {
  return (
    <section className="space-y-4">
      <Breadcrumb items={[{ label: 'Report' }, { label: 'Usage report' }]} />
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-base font-semibold text-slate-900">Usage report</h2>
        <p className="mt-1 text-sm text-slate-600">Usage report screen (placeholder).</p>
      </div>
    </section>
  )
}

