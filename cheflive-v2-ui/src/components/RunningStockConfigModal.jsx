import { useCallback, useEffect, useId, useState } from 'react'
import { X } from 'lucide-react'
import { Button } from './Button.jsx'
import { MultiSelect } from './MultiSelect.jsx'
import { getRunningStockConfig, upsertRunningStockConfig } from '../apis/runningStockConfig.js'
import { OriginsProvider, useOrigins } from '../context/OriginsContext.jsx'

function formatQtyInput(v) {
  if (v === null || v === undefined) return ''
  const n = Number(v)
  if (!Number.isFinite(n)) return ''
  return n % 1 === 0 ? String(n) : String(n)
}

function parseQtyInput(raw) {
  const s = String(raw ?? '').trim()
  if (!s) return null
  const n = Number(s.replace(',', '.'))
  if (!Number.isFinite(n) || n < 0) return undefined
  return n
}

function QtyField({ label, unit, value, onChange, disabled }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700">{label}</label>
      <div className="flex gap-2">
        <input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="box-border h-9 flex-1 rounded-lg border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:border-slate-400 disabled:bg-slate-50"
        />
        <div className="flex h-9 min-w-[4rem] items-center justify-center rounded-lg border border-slate-200 bg-slate-50 px-2 text-sm text-slate-600">
          {unit || '—'}
        </div>
      </div>
    </div>
  )
}

function RunningStockConfigModalInner({ open, ingredient, onClose }) {
  const titleId = useId()
  const { options: originOptions, defaultOriginId } = useOrigins()

  const ingredientId = Number(ingredient?.id)
  const systemUnit = String(ingredient?.unit ?? '').trim()

  const [originId, setOriginId] = useState('')
  const [openingQty, setOpeningQty] = useState('')
  const [reorderThresholdQty, setReorderThresholdQty] = useState('')
  const [minimumReorderQty, setMinimumReorderQty] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) {
      setOriginId('')
      setOpeningQty('')
      setReorderThresholdQty('')
      setMinimumReorderQty('')
      setError('')
      setLoading(false)
      setSaving(false)
    }
  }, [open])

  useEffect(() => {
    if (!open || !Number.isFinite(ingredientId)) return
    if (originId) return
    if (defaultOriginId) setOriginId(String(defaultOriginId))
    else if (originOptions.length) setOriginId(String(originOptions[0].value))
  }, [open, ingredientId, originId, defaultOriginId, originOptions])

  const loadConfig = useCallback(async () => {
    const oId = Number(originId)
    if (!Number.isFinite(ingredientId) || !Number.isFinite(oId) || oId <= 0) return

    setLoading(true)
    setError('')
    try {
      const data = await getRunningStockConfig({ ingredient_id: ingredientId, origin_id: oId })
      const cfg = data?.configuration ?? null
      setOpeningQty(formatQtyInput(cfg?.opening_stock_qty))
      setReorderThresholdQty(formatQtyInput(cfg?.reorder_threshold_qty))
      setMinimumReorderQty(formatQtyInput(cfg?.minimum_reorder_qty))
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Failed to load stock settings')
    } finally {
      setLoading(false)
    }
  }, [ingredientId, originId])

  useEffect(() => {
    if (!open || !originId) return
    void loadConfig()
  }, [open, originId, loadConfig])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const canSave = Number.isFinite(ingredientId) && Number(originId) > 0

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="presentation"
      onMouseDown={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-lg"
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div>
            <div id={titleId} className="text-base font-semibold text-slate-900">
              Stock settings
            </div>
            <div className="mt-1 text-sm text-slate-600">
              {ingredient?.name ? String(ingredient.name) : `Ingredient #${ingredientId}`}
              {systemUnit ? (
                <span className="ml-2 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs">
                  Unit: {systemUnit}
                </span>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-4">
          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
          ) : null}

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Origin</label>
            <MultiSelect
              options={originOptions}
              value={originId}
              onChange={(v) => setOriginId(v ? String(v) : '')}
              placeholder="Select origin…"
              isMulti={false}
            />
          </div>

          <QtyField
            label="Opening stock"
            unit={systemUnit}
            value={openingQty}
            onChange={setOpeningQty}
            disabled={loading || saving}
          />
          <QtyField
            label="Reorder threshold"
            unit={systemUnit}
            value={reorderThresholdQty}
            onChange={setReorderThresholdQty}
            disabled={loading || saving}
          />
          <QtyField
            label="Minimum reorder"
            unit={systemUnit}
            value={minimumReorderQty}
            onChange={setMinimumReorderQty}
            disabled={loading || saving}
          />

          {loading ? <div className="text-sm text-slate-500">Loading…</div> : null}

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
            <Button variant="secondary" type="button" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button
              variant="primary"
              type="button"
              disabled={!canSave || saving || loading}
              onClick={async () => {
                if (!canSave || saving) return
                const oId = Number(originId)
                const opening = parseQtyInput(openingQty)
                const threshold = parseQtyInput(reorderThresholdQty)
                const minimum = parseQtyInput(minimumReorderQty)
                if (opening === undefined || threshold === undefined || minimum === undefined) {
                  setError('Quantities must be non-negative numbers.')
                  return
                }
                setSaving(true)
                setError('')
                try {
                  await upsertRunningStockConfig({
                    ingredient_id: ingredientId,
                    origin_id: oId,
                    opening_stock_qty: opening,
                    reorder_threshold_qty: threshold,
                    minimum_reorder_qty: minimum,
                  })
                  onClose()
                } catch (e) {
                  setError(e?.response?.data?.error || e?.message || 'Failed to save stock settings')
                } finally {
                  setSaving(false)
                }
              }}
            >
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function RunningStockConfigModal(props) {
  return (
    <OriginsProvider>
      <RunningStockConfigModalInner {...props} />
    </OriginsProvider>
  )
}
