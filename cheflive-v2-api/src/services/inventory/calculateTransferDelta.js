/**
 * Sum line qty per ingredient (multiple lines for the same ingredient are combined).
 * @param {Array<{ ingredient_id?: unknown, qty?: unknown }>} items
 * @returns {Map<number, number>}
 */
function qtyByIngredient(items) {
  const map = new Map()
  const list = Array.isArray(items) ? items : []
  for (const it of list) {
    const ingredient_id = Number(it?.ingredient_id)
    const qty = Number(it?.qty)
    if (!Number.isFinite(ingredient_id) || ingredient_id <= 0) continue
    if (!Number.isFinite(qty)) continue
    map.set(ingredient_id, (map.get(ingredient_id) || 0) + qty)
  }
  return map
}

/**
 * Compare old vs new transfer line items and return per-ingredient qty deltas.
 * delta_qty = new_qty - old_qty (0 for removed items, positive for additions).
 *
 * @param {Array<{ ingredient_id: number, qty: number }>} oldItems
 * @param {Array<{ ingredient_id: number, qty: number }>} newItems
 * @returns {{ deltas: Array<{ ingredient_id: number, qty_delta: number }> }}
 */
function calculateTransferDelta(oldItems, newItems) {
  const oldMap = qtyByIngredient(oldItems)
  const newMap = qtyByIngredient(newItems)
  const ingredientIds = new Set([...oldMap.keys(), ...newMap.keys()])

  const deltas = []
  for (const ingredient_id of ingredientIds) {
    const oldQty = oldMap.get(ingredient_id) || 0
    const newQty = newMap.get(ingredient_id) || 0
    const qty_delta = newQty - oldQty
    if (qty_delta === 0) continue
    deltas.push({ ingredient_id, qty_delta })
  }

  return { deltas }
}

/**
 * Plan stock adjustments for a transfer edit.
 * When origins are unchanged, returns qty deltas only. When origins change,
 * returns a full revert + reapply plan (ledger-safe, avoids wrong-origin deltas).
 *
 * @param {any} previous Transfer snapshot before update (with items)
 * @param {any} next Transfer snapshot after update (with items)
 */
function calculateTransferStockAdjustments(previous, next) {
  const prevFrom = previous?.from_origin_id ?? null
  const prevTo = previous?.to_origin_id ?? null
  const nextFrom = next?.from_origin_id ?? null
  const nextTo = next?.to_origin_id ?? null

  const originsUnchanged =
    Number(prevFrom) === Number(nextFrom) && Number(prevTo) === Number(nextTo)

  if (originsUnchanged) {
    const { deltas } = calculateTransferDelta(
      Array.isArray(previous?.items) ? previous.items : [],
      Array.isArray(next?.items) ? next.items : [],
    )
    return {
      mode: 'delta',
      from_origin_id: nextFrom != null ? Number(nextFrom) : null,
      to_origin_id: nextTo != null ? Number(nextTo) : null,
      deltas,
    }
  }

  return {
    mode: 'replace',
    revert: {
      organization_id: Number(previous.organization_id),
      from_origin_id: prevFrom != null ? Number(prevFrom) : null,
      to_origin_id: prevTo != null ? Number(prevTo) : null,
      items: Array.isArray(previous?.items) ? previous.items : [],
    },
    apply: {
      organization_id: Number(next.organization_id),
      from_origin_id: nextFrom != null ? Number(nextFrom) : null,
      to_origin_id: nextTo != null ? Number(nextTo) : null,
      items: Array.isArray(next?.items) ? next.items : [],
    },
  }
}

module.exports = {
  calculateTransferDelta,
  calculateTransferStockAdjustments,
  qtyByIngredient,
}
