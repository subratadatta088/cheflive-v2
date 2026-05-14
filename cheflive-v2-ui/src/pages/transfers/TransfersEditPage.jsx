import { useParams } from 'react-router-dom'
import { Breadcrumb } from '../../components/Breadcrumb.jsx'
import { OriginsProvider } from '../../context/OriginsContext.jsx'
import { TransfersTransferForm } from './TransfersCreatePage.jsx'

function TransfersEditInnerPage() {
  const { id: idParam } = useParams()
  const id = Number(idParam)

  if (!Number.isFinite(id) || id <= 0) {
    return (
      <section className="space-y-4">
        <Breadcrumb items={[{ label: 'Transfers', href: '/transfers/history' }, { label: 'Edit' }]} />
        <p className="text-sm text-red-700">Invalid transfer id.</p>
      </section>
    )
  }

  return <TransfersTransferForm editTransferId={id} />
}

export function TransfersEditPage() {
  return (
    <OriginsProvider>
      <TransfersEditInnerPage />
    </OriginsProvider>
  )
}
