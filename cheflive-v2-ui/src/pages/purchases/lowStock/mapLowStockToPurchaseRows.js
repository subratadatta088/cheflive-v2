/**
 * @param {Array<Record<string, unknown>>} items
 * @returns {Array<Record<string, unknown>>}
 */
export function mapLowStockToPurchaseRows(items) {
  const list = Array.isArray(items) ? items : []
  return list.map((it) => {
    const ingId = Number(it?.ingredient_id)
    const code = it?.item_code === null || it?.item_code === undefined ? '' : String(it.item_code)
    const name = it?.ingredient_name ? String(it.ingredient_name) : ''
    const label = code ? `${name} (${code})` : name || (Number.isFinite(ingId) ? `#${ingId}` : '')
    const unit = it?.unit ? String(it.unit) : ''
    const qty = it?.qty
    const qtyStr =
      qty === null || qty === undefined
        ? ''
        : Number.isFinite(Number(qty))
          ? Number(qty) % 1 === 0
            ? String(Number(qty))
            : String(Number(qty))
          : ''
    const basePrice =
      it?.base_price === null || it?.base_price === undefined
        ? it?.unit_price === null || it?.unit_price === undefined
          ? ''
          : String(it.unit_price)
        : String(it.base_price)

    return {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      item_code: code,
      ingredient_id: Number.isFinite(ingId) ? String(ingId) : '',
      ingredient_label: label,
      qty: qtyStr,
      unit,
      unitPrice: basePrice,
      unitOptions: unit ? [{ value: unit, label: unit }] : null,
      unitConversions: null,
      baseUnit: unit,
      basePrice,
      defaultStockQtyStr: '',
      defaultStockUnit: '',
      defaultStockLoading: false,
    }
  })
}
