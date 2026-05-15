import { useParams } from 'react-router-dom'
import { Breadcrumb } from '../../components/Breadcrumb.jsx'
import { OriginsProvider } from '../../context/OriginsContext.jsx'
import { UtilizationsUtilizationForm } from './UtilizationsCreatePage.jsx'

function UtilizationsEditInnerPage() {
  const { id: idParam } = useParams()
  const id = Number(idParam)

  if (!Number.isFinite(id) || id <= 0) {
    return (
      <section className="space-y-4">
        <Breadcrumb items={[{ label: 'Utilizations', href: '/utilizations/history' }, { label: 'Edit' }]} />
        <p className="text-sm text-red-700">Invalid utilization id.</p>
      </section>
    )
  }

  return <UtilizationsUtilizationForm editUtilizationId={id} />
}

export function UtilizationsEditPage() {
  return (
    <OriginsProvider>
      <UtilizationsEditInnerPage />
    </OriginsProvider>
  )
}
