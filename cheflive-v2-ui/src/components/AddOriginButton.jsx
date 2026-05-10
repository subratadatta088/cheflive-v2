import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from './Button.jsx'
import { AddOriginModal } from './AddOriginModal.jsx'

/**
 * Reusable "Add origin" button with create modal.
 *
 * @param {{
 *   className?: string,
 *   variant?: 'primary' | 'secondary' | 'warning' | 'danger',
 *   onCreated?: (origin: unknown) => void,
 * }} props
 */
export function AddOriginButton({ className = '', variant = 'secondary', onCreated }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button type="button" variant={variant} className={className} onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" aria-hidden="true" />
        Add origin
      </Button>
      <AddOriginModal open={open} onClose={() => setOpen(false)} onCreated={onCreated} />
    </>
  )
}

