/** Row id + field markers for purchase line grid focus (Create purchase page). */

/** Root `<form>` on Create purchase (used by Ctrl+S → `requestSubmit()`). */
export const PURCHASE_CREATE_FORM_ATTR = 'data-purchase-create-form'

export const PURCHASE_LINE_ROW_ATTR = 'data-purchase-line-row'
export const PURCHASE_LINE_FIELD_ATTR = 'data-purchase-line-field'

export const PURCHASE_FIELD_ITEM_CODE = 'item_code'
export const PURCHASE_FIELD_INGREDIENT_ID = 'ingredient_id'

/** @param {string} rowId @param {string} field */
function escapeRowId(rowId) {
  return typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(String(rowId)) : String(rowId)
}

/**
 * Barcode `<input>` or ingredient react-select inner `<input>`.
 * @param {string} rowId
 * @param {typeof PURCHASE_FIELD_ITEM_CODE | typeof PURCHASE_FIELD_INGREDIENT_ID} field
 * @returns {HTMLElement | null}
 */
function getPurchaseLineControl(rowId, field) {
  const rid = escapeRowId(rowId)
  const sel = `[${PURCHASE_LINE_ROW_ATTR}="${rid}"][${PURCHASE_LINE_FIELD_ATTR}="${field}"]`
  const root = document.querySelector(sel)
  if (!root) return null
  const input =
    root instanceof HTMLInputElement ? root : root.querySelector?.('input') ?? null
  return input instanceof HTMLElement ? input : null
}

/**
 * Focus item_code input or ingredient react-select input for a row.
 * @param {string} rowId
 * @param {typeof PURCHASE_FIELD_ITEM_CODE | typeof PURCHASE_FIELD_INGREDIENT_ID} field
 * @returns {boolean}
 */
export function focusPurchaseLineField(rowId, field) {
  const input = getPurchaseLineControl(rowId, field)
  if (!input) return false
  input.focus({ preventScroll: false })
  return true
}

/**
 * Blur item_code input or ingredient react-select input for a row.
 * @param {string} rowId
 * @param {typeof PURCHASE_FIELD_ITEM_CODE | typeof PURCHASE_FIELD_INGREDIENT_ID} field
 * @returns {boolean}
 */
export function blurPurchaseLineField(rowId, field) {
  const input = getPurchaseLineControl(rowId, field)
  if (!input) return false
  input.blur()
  return true
}

/**
 * Submit the Create purchase form programmatically (keyboard shortcut).
 * @returns {boolean} Whether a form was found and `requestSubmit()` was called.
 */
export function requestPurchaseCreateSave() {
  const form =
    typeof document !== 'undefined'
      ? document.querySelector(`form[${PURCHASE_CREATE_FORM_ATTR}]`)
      : null
  if (!(form instanceof HTMLFormElement)) return false
  form.requestSubmit()
  return true
}
