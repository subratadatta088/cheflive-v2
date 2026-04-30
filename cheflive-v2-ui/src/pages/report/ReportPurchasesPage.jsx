import { Breadcrumb } from '../../components/Breadcrumb.jsx'

export function ReportPurchasesPage() {
  return (
    <section className="space-y-4">
      <Breadcrumb items={[{ label: 'Report' }, { label: 'Purchase report' }]} />
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-base font-semibold text-slate-900">Purchase report</h2>
        <p className="mt-1 text-sm text-slate-600">Purchase report screen (placeholder).</p>
      </div>
    </section>
  )
}

