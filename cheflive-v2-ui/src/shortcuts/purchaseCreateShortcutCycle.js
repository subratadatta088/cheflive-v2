import { PURCHASE_LINE_FIELD_ATTR, PURCHASE_LINE_ROW_ATTR } from './purchaseCreateDom.js'

/**
 * Next row index for Ctrl+I / Ctrl+B cycling: advance from focused line field if possible,
 * otherwise from last shortcut index; wraps to 0 past last row.
 * @template {{ id: string }} R
 * @param {R[]} rows
 * @param {EventTarget | null} activeElement
 * @param {string} fieldAttrValue `item_code` | `ingredient_id`
 * @param {{ current: number }} lastRef index after last shortcut (-1 = unset)
 */
export function nextShortcutRowIndex(rows, activeElement, fieldAttrValue, lastRef) {
  const rowCount = rows.length
  if (rowCount <= 0) return 0

  let idxFromFocus = null
  if (activeElement instanceof Element) {
    const host = activeElement.closest(`[${PURCHASE_LINE_FIELD_ATTR}="${fieldAttrValue}"]`)
    const rid = host?.getAttribute?.(PURCHASE_LINE_ROW_ATTR)
    if (rid != null && host?.getAttribute?.(PURCHASE_LINE_FIELD_ATTR) === fieldAttrValue) {
      const i = rows.findIndex((r) => String(r.id) === String(rid))
      if (i >= 0) idxFromFocus = i
    }
  }

  if (idxFromFocus !== null) {
    return (idxFromFocus + 1) % rowCount
  }

  return (lastRef.current + 1) % rowCount
}
