import { useEffect, useId, useState } from 'react'
import { X } from 'lucide-react'
import { Button } from './Button.jsx'
import { useToast } from './Toaster.jsx'
import { createPreparation } from '../apis/preparation.js'
import { PreparationForm } from '../pages/inventory/preparation/PreparationForm.jsx'
import {
  buildPreparationWritePayload,
  emptyPreparationFormState,
  validatePreparationForm,
} from '../pages/inventory/preparation/preparationFormUtils.js'

/**
 * @param {{
 *   open: boolean,
 *   onClose: () => void,
 *   onCreated?: (preparation: unknown) => void,
 * }} props
 */
export function CreatePreparationModal({ open, onClose, onCreated }) {
  const titleId = useId()
  const { showToast } = useToast()
  const [form, setForm] = useState(emptyPreparationFormState)
  const [errors, setErrors] = useState({})
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
    setForm(emptyPreparationFormState())
    setErrors({})
    setError('')
    setSubmitting(false)
  }, [open])

  if (!open) return null

  const handleFieldChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => {
      const next = { ...prev }
      delete next[field]
      if (field !== 'rows') delete next.items
      return next
    })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const nextErrors = validatePreparationForm(form)
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors)
      return
    }

    setSubmitting(true)
    setError('')
    try {
      const payload = buildPreparationWritePayload(form)
      const data = await createPreparation(payload)
      const preparation = data?.preparation ?? data
      showToast({ text: 'Preparation created.', theme: 'success', duration: 4000 })
      onCreated?.(preparation)
      onClose()
    } catch (err) {
      const apiMsg = err?.response?.data?.error || err?.message || 'Could not create preparation.'
      setError(String(apiMsg))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="presentation"
      onMouseDown={(ev) => {
        if (ev.target === ev.currentTarget && !submitting) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[92vh] w-full max-w-7xl flex-col overflow-hidden rounded-xl bg-white shadow-lg"
        onMouseDown={(ev) => ev.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 id={titleId} className="text-base font-semibold text-slate-900">
            Create preparation
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

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {error ? (
              <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                {error}
              </div>
            ) : null}
            <PreparationForm
              form={form}
              errors={errors}
              disabled={submitting}
              onFieldChange={handleFieldChange}
              onRowsChange={(updater) => {
                setForm((prev) => ({
                  ...prev,
                  rows: typeof updater === 'function' ? updater(prev.rows) : updater,
                }))
                setErrors((e) => {
                  const next = { ...e }
                  delete next.items
                  return next
                })
              }}
            />
          </div>

          <div className="flex shrink-0 items-center justify-end gap-2 border-t border-slate-200 px-4 py-3">
            <Button type="button" variant="secondary" disabled={submitting} onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={submitting}>
              {submitting ? 'Saving…' : 'Save preparation'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
