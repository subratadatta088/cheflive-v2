import { useCallback, useEffect, useId, useRef } from 'react'
import { X } from 'lucide-react'
import { Button } from './Button.jsx'

/**
 * @param {{
 *   open: boolean,
 *   title?: string,
 *   description?: string,
 *   confirmText?: string,
 *   confirmVariant?: 'primary'|'secondary'|'warning'|'danger',
 *   cancelText?: string,
 *   onCancel: () => void,
 *   onConfirm: () => void,
 *   isConfirmDisabled?: boolean,
 * }} props
 */
export function ConfirmModal({
  open,
  title = 'Confirm',
  description = 'Are you sure?',
  confirmText = 'Confirm',
  confirmVariant = 'danger',
  cancelText = 'Cancel',
  onCancel,
  onConfirm,
  isConfirmDisabled = false,
}) {
  const id = useId()
  const dialogRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onCancel])

  const handleBackdropClick = useCallback(
    (e) => {
      if (e.target === e.currentTarget) onCancel()
    },
    [onCancel],
  )

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="presentation" onMouseDown={handleBackdropClick}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-desc`}
        className="max-h-[90vh] w-full max-w-md overflow-hidden rounded-xl bg-white shadow-lg"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 id={`${id}-title`} className="text-base font-semibold text-slate-900">
            {title}
          </h2>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4">
          <p id={`${id}-desc`} className="text-sm text-slate-600">
            {description}
          </p>

          <div className="mt-6 flex justify-end gap-2">
            <Button variant="secondary" type="button" onClick={onCancel}>
              {cancelText}
            </Button>
            <Button variant={confirmVariant} type="button" onClick={onConfirm} disabled={isConfirmDisabled}>
              {confirmText}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

