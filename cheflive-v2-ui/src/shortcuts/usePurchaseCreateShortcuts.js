import { useEffect, useRef } from 'react'
import {
  focusPurchaseLineField,
  PURCHASE_FIELD_INGREDIENT_ID,
  PURCHASE_FIELD_ITEM_CODE,
  requestPurchaseCreateSave,
} from './purchaseCreateDom.js'
import { nextShortcutRowIndex } from './purchaseCreateShortcutCycle.js'

/**
 * Global shortcuts for Create purchase: row +/- , cycle focus item / barcode columns.
 *
 * @param {{
 *   rowsRef: React.MutableRefObject<{ id: string }[] | null | undefined>,
 *   setRows: (updater: import('react').SetStateAction<any[]>) => void,
 *   newRow: () => { id: string } & Record<string, unknown>,
 *   clearFieldError: (key: string) => void,
 *   isSubmittingRef: React.MutableRefObject<boolean>,
 * }} opts
 */
export function usePurchaseCreateShortcuts({ rowsRef, setRows, newRow, clearFieldError, isSubmittingRef }) {
  const setRowsRef = useRef(setRows)
  const clearFieldErrorRef = useRef(clearFieldError)
  const lastItemCodeRef = useRef(-1)
  const lastIngredientRef = useRef(-1)

  setRowsRef.current = setRows
  clearFieldErrorRef.current = clearFieldError

  useEffect(() => {
    function onKeyDown(e) {
      if (!e.ctrlKey || e.altKey || e.metaKey) return
      if (isSubmittingRef.current) return

      if (e.code === 'KeyS') {
        e.preventDefault()
        e.stopPropagation()
        requestPurchaseCreateSave()
        return
      }

      const rows = Array.isArray(rowsRef.current) ? rowsRef.current : []

      if (e.code === 'KeyI') {
        e.preventDefault()
        e.stopPropagation()
        const next = nextShortcutRowIndex(rows, document.activeElement, PURCHASE_FIELD_INGREDIENT_ID, lastIngredientRef)
        lastIngredientRef.current = next
        if (rows[next]) focusPurchaseLineField(rows[next].id, PURCHASE_FIELD_INGREDIENT_ID)
        return
      }

      if (e.code === 'KeyB') {
        e.preventDefault()
        e.stopPropagation()
        const next = nextShortcutRowIndex(rows, document.activeElement, PURCHASE_FIELD_ITEM_CODE, lastItemCodeRef)
        lastItemCodeRef.current = next
        if (rows[next]) focusPurchaseLineField(rows[next].id, PURCHASE_FIELD_ITEM_CODE)
        return
      }

      const el = /** @type {EventTarget | null} */ (e.target)
      if (el instanceof HTMLElement && el.closest('input, textarea, select, [contenteditable="true"]')) {
        return
      }

      const isPlus = e.code === 'NumpadAdd' || e.code === 'Equal'
      const isMinus = e.code === 'Minus' || e.code === 'NumpadSubtract'
      if (!isPlus && !isMinus) return

      e.preventDefault()
      e.stopPropagation()

      if (isPlus) {
        setRowsRef.current((prev) => [...prev, newRow()])
        clearFieldErrorRef.current('items')
        return
      }

      setRowsRef.current((prev) => {
        if (prev.length <= 1) return prev
        return prev.slice(0, -1)
      })
      clearFieldErrorRef.current('items')
    }

    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  // eslint-disable-next-line react-hooks/exhaustive-deps -- refs/setRows refs updated each render
  }, [])
}
