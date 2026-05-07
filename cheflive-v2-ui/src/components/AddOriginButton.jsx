import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from './Button.jsx'
import { AddOriginModal } from './AddOriginModal.jsx'

/**
 * Reusable "Add origin" button (UI-only for now).
 * Can be dropped into Purchases page and Origins page later.
 *
 * @param {{
 *   className?: string,
 *   variant?: 'primary' | 'secondary' | 'warning' | 'danger',
 * }} props
 */
export function AddOriginButton({ className = '', variant = 'secondary' }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button type="button" variant={variant} className={className} onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" aria-hidden="true" />
        Add origin
      </Button>
      <AddOriginModal open={open} onClose={() => setOpen(false)} />
    </>
  )
}

