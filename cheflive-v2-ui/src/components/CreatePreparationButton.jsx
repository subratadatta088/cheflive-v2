import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from './Button.jsx'
import { CreatePreparationModal } from './CreatePreparationModal.jsx'

/**
 * @param {{
 *   className?: string,
 *   variant?: 'primary' | 'secondary' | 'warning' | 'danger' | 'dark',
 *   onCreated?: (preparation: unknown) => void,
 * }} props
 */
export function CreatePreparationButton({ className = '', variant = 'secondary', onCreated }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button type="button" variant={variant} className={className} onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" aria-hidden="true" />
        Create preparation
      </Button>
      <CreatePreparationModal
        open={open}
        onClose={() => setOpen(false)}
        onCreated={(prep) => {
          onCreated?.(prep)
          setOpen(false)
        }}
      />
    </>
  )
}
