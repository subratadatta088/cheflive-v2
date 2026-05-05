import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { Button } from './Button.jsx'

/**
 * @param {{
 *   open: boolean,
 *   onClose: () => void,
 *   onCreate?: (name: string) => Promise<void> | void,
 * }} props
 */
export function AddCategoryModal({ open, onClose, onCreate }) {
  const id = useId()
  const [name, setName] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const dialogRef = useRef(null)

  useEffect(() => {
    if (!open) {
      setName('')
      setIsSaving(false)
      setError('')
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const handleBackdropClick = useCallback(
    (e) => {
      if (e.target === e.currentTarget) onClose()
    },
    [onClose],
  )

  if (!open) return null

  const canSave = name.trim().length > 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="presentation" onMouseDown={handleBackdropClick}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        className="max-h-[90vh] w-full max-w-md overflow-hidden rounded-xl bg-white shadow-lg"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 id={`${id}-title`} className="text-base font-semibold text-slate-900">
            Add category
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form
          className="p-4"
          onSubmit={async (e) => {
            e.preventDefault()
            if (!canSave || isSaving) return
            setError('')
            setIsSaving(true)
            try {
              await onCreate?.(name.trim())
              onClose()
            } catch (err) {
              setError(err?.response?.data?.message || err?.message || 'Failed to create category')
              setIsSaving(false)
            }
          }}
        >
          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">Category name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-300"
              placeholder="e.g. Bakery"
              autoFocus
            />
          </label>

          {error ? <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div> : null}

          <div className="mt-6 flex justify-end gap-2">
            <Button variant="secondary" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={!canSave || isSaving}>
              {isSaving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

