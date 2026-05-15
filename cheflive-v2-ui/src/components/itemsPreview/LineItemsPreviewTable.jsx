import { formatMoney, formatQtyDisplay } from '../../utils/formatters.js'

/** @param {unknown} it */
function lineExtendedFromUnitPrice(it) {
  const q = Number(it?.qty)
  const raw = it?.unit_price
  const price = raw === null || raw === undefined || raw === '' ? NaN : Number(raw)
  if (!Number.isFinite(q) || !Number.isFinite(price)) return null
  return q * price
}

/** @param {unknown} raw */
function numOrNull(raw) {
  const n = raw === null || raw === undefined || raw === '' ? NaN : Number(raw)
  return Number.isFinite(n) ? n : null
}

/**
 * @typedef {'purchase-single' | 'purchase-grouped' | 'purchase-flat' | 'qty-only'} LineItemsTableVariant
 */

/**
 * @param {{
 *   items: Array<Record<string, unknown>>,
 *   variant?: LineItemsTableVariant,
 * }} props
 */
export function LineItemsPreviewTable({ items, variant = 'qty-only' }) {
  if (!Array.isArray(items) || items.length === 0) {
    return <p className="text-sm text-slate-600">No line items.</p>
  }

  const showUnitPrice = variant === 'purchase-single'
  const showPrice = variant === 'purchase-flat'
  const showLineTotal = variant !== 'qty-only'
  const grouped = variant === 'purchase-grouped'
  const flat = variant === 'purchase-flat'

  const lineTotalHeader = grouped || flat ? 'Subtotal' : 'Line total'
  const priceHeader = flat ? 'Price' : 'Unit price'

  return (
    <table className="w-full min-w-[520px] border-collapse text-sm">
      <thead>
        <tr className="border-b border-slate-200 text-left text-xs font-bold uppercase tracking-wide text-slate-700">
          <th className="pb-2 pe-3">Ingredient</th>
          <th className="w-24 pb-2 pe-3 text-right">Qty</th>
          <th className="w-24 pb-2 pe-3">Unit</th>
          {showUnitPrice || showPrice ? (
            <th className="w-28 pb-2 pe-3 text-right">{priceHeader}</th>
          ) : null}
          {showLineTotal ? <th className="w-28 pb-2 text-right">{lineTotalHeader}</th> : null}
        </tr>
      </thead>
      <tbody>
        {items.map((it) => {
          const nameRaw =
            it.ingredient_name != null && String(it.ingredient_name).trim() !== ''
              ? String(it.ingredient_name).trim()
              : ''

          let lineTotal = null
          if (grouped || flat) {
            lineTotal = numOrNull(it?.subtotal)
          } else if (showUnitPrice) {
            lineTotal = lineExtendedFromUnitPrice(it)
          }

          const priceCell = flat
            ? numOrNull(it?.price)
            : showUnitPrice
              ? numOrNull(it?.unit_price)
              : null

          return (
            <tr
              key={
                it.id ??
                `${it.ingredient_id}-${it.qty}-${it.purchase_id ?? it.transfer_id ?? it.utilization_id ?? ''}`
              }
              className="border-b border-slate-100"
            >
              <td className="py-2 pe-3 text-slate-900">
                <div className="font-medium">{nameRaw || 'Unknown ingredient'}</div>
                {it.ingredient_id != null ? (
                  <div className="text-xs tabular-nums text-slate-500">#{it.ingredient_id}</div>
                ) : null}
              </td>
              <td className="py-2 pe-3 text-right tabular-nums">{formatQtyDisplay(Number(it.qty))}</td>
              <td className="py-2 pe-3 text-slate-700">
                {it.unit != null && String(it.unit).trim() !== '' ? String(it.unit) : '—'}
              </td>
              {showUnitPrice || showPrice ? (
                <td className="py-2 pe-3 text-right tabular-nums">
                  {priceCell !== null ? formatMoney(priceCell) : '—'}
                </td>
              ) : null}
              {showLineTotal ? (
                <td className="py-2 text-right tabular-nums text-slate-900">
                  {lineTotal !== null ? formatMoney(lineTotal) : '—'}
                </td>
              ) : null}
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
