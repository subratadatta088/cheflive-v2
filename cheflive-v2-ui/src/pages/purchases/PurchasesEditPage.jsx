import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Breadcrumb } from '../../components/Breadcrumb.jsx'
import { Button } from '../../components/Button.jsx'
import { getPurchaseById, updatePurchaseById } from '../../apis/purchase.js'
import { listOrigins } from '../../apis/origin.js'
import { useToast } from '../../components/Toaster.jsx'

export function PurchasesEditPage() {
  const { id: idParam } = useParams()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const id = Number(idParam)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [originOptions, setOriginOptions] = useState(() => /** @type {{ id: number, name: string }[]} */ ([]))
  const [originId, setOriginId] = useState('')
  const [date, setDate] = useState('')
  const [note, setNote] = useState('')

  const load = useCallback(async () => {
    if (!Number.isFinite(id) || id <= 0) {
      setError('Invalid purchase id.')
      setLoading(false)
      return
    }
    setError('')
    setLoading(true)
    try {
      const [origRes, purRes] = await Promise.all([
        listOrigins({ limit: 200, is_active: true }),
        getPurchaseById(id),
      ])
      const oItems = Array.isArray(origRes?.items) ? origRes.items : []
      setOriginOptions(
        oItems
          .map((o) => {
            const oid = Number(o?.id)
            if (!Number.isFinite(oid) || oid <= 0) return null
            const nameRaw = o?.name != null ? String(o.name).trim() : ''
            return { id: oid, name: nameRaw || `Origin #${oid}` }
          })
          .filter(Boolean)
          .sort((a, b) => a.name.localeCompare(b.name)),
      )

      const p = purRes?.purchase ?? purRes
      if (!p?.id) {
        setError('Purchase not found.')
        return
      }
      setOriginId(String(Number(p.origin_id) || ''))
      const d = p.date != null ? String(p.date).trim() : ''
      setDate(d.length >= 10 ? d.slice(0, 10) : d)
      setNote(p.note != null && p.note !== undefined ? String(p.note) : '')
    } catch (e) {
      setError(e?.response?.data?.error || e?.response?.data?.message || e?.message || 'Failed to load purchase.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!Number.isFinite(id) || id <= 0) return
    const oid = Number(originId)
    if (!Number.isFinite(oid) || oid <= 0) {
      setError('Please select a received-at origin.')
      return
    }
    setSaving(true)
    setError('')
    try {
      await updatePurchaseById(id, {
        origin_id: oid,
        date: date.trim() || undefined,
        note: note.trim() === '' ? null : note.trim(),
      })
      showToast({ text: 'Purchase updated.', theme: 'success', duration: 4000 })
      navigate('/purchases/history')
    } catch (e) {
      setError(e?.response?.data?.error || e?.response?.data?.message || e?.message || 'Failed to save.')
    } finally {
      setSaving(false)
    }
  }

  if (!Number.isFinite(id) || id <= 0) {
    return (
      <section className="space-y-4">
        <Breadcrumb items={[{ label: 'Purchases', href: '/purchases/history' }, { label: 'Edit' }]} />
        <p className="text-sm text-red-700">Invalid purchase id.</p>
      </section>
    )
  }

  return (
    <section className="mx-auto max-w-lg space-y-4">
      <Breadcrumb items={[{ label: 'Purchases', href: '/purchases/history' }, { label: 'Edit' }]} />

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Edit purchase #{id}</h2>
        <p className="mt-1 text-sm text-slate-600">Update date, note, and where stock was received. Line items are not editable here.</p>

        {error ? (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
        ) : null}

        {loading ? (
          <p className="mt-6 text-sm text-slate-600">Loading…</p>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <label className="block space-y-1">
              <span className="text-sm font-medium text-slate-900">Received at</span>
              <select
                required
                value={originId}
                onChange={(e) => setOriginId(e.target.value)}
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-300"
              >
                <option value="" disabled>
                  Select origin…
                </option>
                {originOptions.map((o) => (
                  <option key={o.id} value={String(o.id)}>
                    {o.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1">
              <span className="text-sm font-medium text-slate-900">Purchase date</span>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-300"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-sm font-medium text-slate-900">Note</span>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-300"
                placeholder="Optional"
              />
            </label>
            <div className="flex flex-wrap gap-2 pt-2">
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </Button>
              <Button type="button" variant="secondary" disabled={saving} onClick={() => navigate('/purchases/history')}>
                Cancel
              </Button>
            </div>
          </form>
        )}
      </div>
    </section>
  )
}
