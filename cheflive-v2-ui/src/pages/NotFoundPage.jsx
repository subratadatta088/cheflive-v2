import { Breadcrumb } from '../components/Breadcrumb.jsx'

export function NotFoundPage() {
  return (
    <section className="space-y-4">
      <Breadcrumb items={[{ label: 'Not found' }]} />
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="text-sm font-medium text-slate-900">Page not found</div>
        <div className="mt-1 text-sm text-slate-600">This route does not exist.</div>
      </div>
    </section>
  )
}

