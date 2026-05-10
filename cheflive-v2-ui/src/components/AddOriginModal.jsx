import { useEffect, useId, useState } from 'react'
import { X } from 'lucide-react'
import { Button } from './Button.jsx'
import { createOrigin } from '../apis/origin.js'
import { useToast } from './Toaster.jsx'

/** API (`OriginCreateSchema`) requires `type`; keep in sync if you add a type field to this form. */
const DEFAULT_ORIGIN_TYPE = 'general'

/**
 * @param {{
 *   open: boolean,
 *   onClose: () => void,
 *   onCreated?: (origin: unknown) => void,
 * }} props
 */
export function AddOriginModal({ open, onClose, onCreated }) {
  const id = useId()
  const { showToast } = useToast()
  const [name, setName] = useState('')
  const [isDefault, setIsDefault] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape' && !submitting) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose, submitting])

  useEffect(() => {
    if (!open) return
    setName('')
    setIsDefault(false)
    setError('')
    setSubmitting(false)
  }, [open])

  if (!open) return null

  async function handleSubmit(e) {
    e.preventDefault()
    const trimmed = String(name ?? '').trim()
    if (!trimmed) {
      setError('Please enter a name.')
      return
    }

    setSubmitting(true)
    setError('')
    try {
      const payload = {
        name: trimmed,
        type: DEFAULT_ORIGIN_TYPE,
        ...(isDefault ? { is_default: true } : {}),
      }
      const data = await createOrigin(payload)
      const origin = data?.origin ?? data
      showToast({ text: 'Origin created.', theme: 'success', duration: 4000 })
      onCreated?.(origin)
      onClose()
    } catch (err) {
      const apiMsg = err?.response?.data?.error || err?.message || 'Could not create origin.'
      setError(String(apiMsg))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        className="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-lg"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 id={`${id}-title`} className="text-base font-semibold text-slate-900">
            Add origin
          </h2>
          <button
            type="button"
            onClick={() => !submitting && onClose()}
            className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50"
            aria-label="Close"
            disabled={submitting}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-4">
          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-900 ms-1">Name</span>
            <input
              id={`${id}-name`}
              type="text"
              name="name"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                if (error) setError('')
              }}
              autoComplete="off"
              disabled={submitting}
              className={
                'h-10 w-full rounded-lg border bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 ' +
                (error && !name.trim()
                  ? 'border-red-400 focus:ring-red-300'
                  : 'border-slate-200 focus:ring-slate-300')
              }
              placeholder="e.g. Main kitchen"
            />
          </label>

          <label className="flex cursor-pointer items-center gap-2 select-none">
            <input
              id={`${id}-default`}
              type="checkbox"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              disabled={submitting}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-slate-400"
            />
            <span className="text-sm text-slate-800">Set as default origin</span>
          </label>

          {error ? (
            <p className="text-xs text-red-600" role="alert">
              {error}
            </p>
          ) : null}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" type="button" onClick={() => !submitting && onClose()} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
