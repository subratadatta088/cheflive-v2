import { useEffect, useId, useState } from 'react'
import { X } from 'lucide-react'
import { Button } from './Button.jsx'
import { useToast } from './Toaster.jsx'
import { getPreparationById, updatePreparation } from '../apis/preparation.js'
import { PreparationForm } from '../pages/inventory/preparation/PreparationForm.jsx'
import {
  buildPreparationWritePayload,
  emptyPreparationFormState,
  preparationToFormState,
  validatePreparationForm,
} from '../pages/inventory/preparation/preparationFormUtils.js'
/**
 * @param {{
 *   open: boolean,
 *   preparationId: number | string | null,
 *   onClose: () => void,
 *   onUpdated?: (preparation: unknown) => void,
 * }} props
 */
export function EditPreparationModal({ open, preparationId, onClose, onUpdated }) {
  const titleId = useId()
  const { showToast } = useToast()
  const [form, setForm] = useState(emptyPreparationFormState)
  const [seedIngredientsById, setSeedIngredientsById] = useState({})
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape' && !submitting && !loading) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose, submitting, loading])

  useEffect(() => {
    if (!open) return
    const pid = Number(preparationId)
    if (!Number.isFinite(pid) || pid <= 0) {
      setError('Invalid preparation.')
      return
    }

    let cancelled = false
    setLoading(true)
    setError('')
    setErrors({})
    setForm(emptyPreparationFormState())
    setSeedIngredientsById({})

    void (async () => {
      try {
        const data = await getPreparationById(pid)
        if (cancelled) return
        const prep = data?.preparation ?? data
        const byId = {}
        for (const it of Array.isArray(prep?.items) ? prep.items : []) {
          const id = Number(it?.ingredient_id)
          if (!Number.isFinite(id) || id <= 0) continue
          byId[String(id)] = {
            id,
            item_code: it?.ingredient_item_code ?? null,
            name: it?.ingredient_name ?? '',
            unit: it?.unit ?? '',
          }
        }
        setSeedIngredientsById(byId)
        setForm(preparationToFormState(prep))
      } catch (err) {
        if (!cancelled) {
          setError(err?.response?.data?.error || err?.message || 'Could not load preparation.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [open, preparationId])

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
    const pid = Number(preparationId)
    if (!Number.isFinite(pid) || pid <= 0) return

    const nextErrors = validatePreparationForm(form)
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors)
      return
    }

    setSubmitting(true)
    setError('')
    try {
      const payload = buildPreparationWritePayload(form)
      const data = await updatePreparation(pid, payload)
      const preparation = data?.preparation ?? data
      showToast({ text: 'Preparation updated.', theme: 'success', duration: 4000 })
      onUpdated?.(preparation)
      onClose()
    } catch (err) {
      const apiMsg = err?.response?.data?.error || err?.message || 'Could not update preparation.'
      setError(String(apiMsg))
    } finally {
      setSubmitting(false)
    }
  }

  const disabled = loading || submitting

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="presentation"
      onMouseDown={(ev) => {
        if (ev.target === ev.currentTarget && !disabled) onClose()
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
            Edit preparation
          </h2>
          <button
            type="button"
            onClick={() => !disabled && onClose()}
            className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50"
            aria-label="Close"
            disabled={disabled}
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
            {loading ? (
              <p className="text-sm text-slate-600">Loading preparation…</p>
            ) : (
              <PreparationForm
                form={form}
                errors={errors}
                disabled={disabled}
                onFieldChange={handleFieldChange}
                seedIngredientsById={seedIngredientsById}
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
            )}
          </div>

          <div className="flex shrink-0 items-center justify-end gap-2 border-t border-slate-200 px-4 py-3">
            <Button type="button" variant="secondary" disabled={disabled} onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={disabled}>
              {submitting ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
