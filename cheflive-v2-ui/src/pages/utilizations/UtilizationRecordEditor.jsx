import { useCallback, useMemo } from 'react'
import { UtilizationRecordCard } from './UtilizationRecordCard.jsx'
import { buildUtilizationLineColumns } from './utilizationLineColumns.jsx'
import {
  getIngredientRunningStockByOrigin,
  getIngredientRunningStockDefault,
  listIngredientUnitConversions,
} from '../../apis/ingredient.js'
import { parseDefaultStockParts } from './utilizationFormUtils.js'

/**
 * @param {{
 *   record: {
 *     preparationId: string,
 *     preparationLabel?: string,
 *     manualMode: boolean,
 *     headerQty: string,
 *     headerUnit: string,
 *     originId: string,
 *     utilizationDate: string,
 *     notes: string,
 *     rows: unknown[],
 *   },
 *   errors?: Record<string, string>,
 *   originOptions: Array<{ id: number, name: string }>,
 *   preparationOptions: { value: string, label: string }[],
 *   preparationLoading?: boolean,
 *   onPreparationSearchChange: (q: string) => void,
 *   onPreparationSelect: (id: string) => void,
 *   defaultOrigin: { id?: number, name?: string } | null,
 *   ingredientOptions: { value: string, label: string }[],
 *   ingredientsById: Record<string, { id: number, item_code?: number|null, name?: string, unit?: string }>,
 *   ingredientsByItemCode: Record<string, { id: number, item_code?: number|null, name?: string, unit?: string }>,
 *   setIngredientSearch: (q: string) => void,
 *   lineReadOnly?: boolean,
 *   showRemove: boolean,
 *   onRemove: () => void,
 *   onFieldChange: (field: string, value: string) => void,
 *   onRowsChange: import('react').Dispatch<import('react').SetStateAction<unknown[]>>,
 * }} props
 */
export function UtilizationRecordEditor({
  record,
  errors,
  originOptions,
  preparationOptions,
  preparationLoading = false,
  onPreparationSearchChange,
  onPreparationSelect,
  defaultOrigin,
  ingredientOptions,
  ingredientsById,
  ingredientsByItemCode,
  setIngredientSearch,
  lineReadOnly = false,
  showRemove,
  onRemove,
  onFieldChange,
  onRowsChange,
}) {
  const loadConversionsIntoRow = useCallback(
    async (rowId, ingredientId) => {
      const ingKey = ingredientId ? String(ingredientId) : ''
      const rowKey = String(rowId)
      if (!ingKey) return
      try {
        const data = await listIngredientUnitConversions(ingKey)
        const convItems = Array.isArray(data?.items) ? data.items : []
        const baseUnit = ingredientsById?.[ingKey]?.unit ? String(ingredientsById[ingKey].unit) : ''
        const units = []
        if (baseUnit) units.push(baseUnit)
        for (const c of convItems) {
          const from = c?.from_unit ? String(c.from_unit) : ''
          const to = c?.to_unit ? String(c.to_unit) : ''
          if (from) units.push(from)
          if (to) units.push(to)
        }
        const uniq = [...new Set(units)]
        const opts = uniq.length ? uniq.map((u) => ({ value: u, label: u })) : null
        onRowsChange((prev) =>
          prev.map((r) => {
            if (String(r.id) !== rowKey) return r
            if (String(r.ingredient_id ?? '') !== ingKey) return r
            return {
              ...r,
              unitOptions: opts,
              unitConversions: convItems,
              unit: baseUnit || String(r.unit ?? ''),
            }
          }),
        )
      } catch (e) {
        console.error('[Unit conversions load failed]', e)
      }
    },
    [ingredientsById, onRowsChange],
  )

  const loadDefaultStockIntoRow = useCallback(
    async (rowId, ingredientId) => {
      const rowKey = String(rowId)
      const ingKey = ingredientId ? String(ingredientId) : ''
      const patch = (mapper) => onRowsChange((prev) => prev.map(mapper))

      if (!ingKey) {
        patch((r) =>
          String(r.id) === rowKey
            ? { ...r, defaultStockQtyStr: '', defaultStockUnit: '', defaultStockLoading: false }
            : r,
        )
        return
      }

      patch((r) =>
        String(r.id) === rowKey && String(r.ingredient_id ?? '') === ingKey
          ? { ...r, defaultStockLoading: true, defaultStockQtyStr: '', defaultStockUnit: '' }
          : r,
      )

      const originStr = String(record.originId ?? '').trim()
      const originNum = originStr ? Number(originStr) : NaN

      try {
        let data
        if (Number.isFinite(originNum) && originNum > 0) {
          data = await getIngredientRunningStockByOrigin(ingKey, originNum)
        } else {
          data = await getIngredientRunningStockDefault(ingKey)
        }
        const parts = parseDefaultStockParts(data?.qty, data?.unit)
        patch((r) => {
          if (String(r.id) !== rowKey || String(r.ingredient_id ?? '') !== ingKey) return r
          if (!parts) {
            return { ...r, defaultStockQtyStr: '—', defaultStockUnit: '', defaultStockLoading: false }
          }
          return {
            ...r,
            defaultStockQtyStr: parts.qtyStr,
            defaultStockUnit: parts.unitStr,
            defaultStockLoading: false,
          }
        })
      } catch {
        patch((r) => {
          if (String(r.id) !== rowKey || String(r.ingredient_id ?? '') !== ingKey) return r
          return { ...r, defaultStockQtyStr: '—', defaultStockUnit: '', defaultStockLoading: false }
        })
      }
    },
    [record.originId, onRowsChange],
  )

  const lineColumns = useMemo(
    () =>
      buildUtilizationLineColumns({
        lineReadOnly,
        originId: record.originId,
        originOptions,
        defaultOrigin,
        ingredientOptions,
        ingredientsById,
        ingredientsByItemCode,
        setIngredientSearch,
        loadConversionsIntoRow,
        loadDefaultStockIntoRow,
      }),
    [
      lineReadOnly,
      record.originId,
      originOptions,
      defaultOrigin,
      ingredientOptions,
      ingredientsById,
      ingredientsByItemCode,
      setIngredientSearch,
      loadConversionsIntoRow,
      loadDefaultStockIntoRow,
    ],
  )

  return (
    <UtilizationRecordCard
      record={record}
      errors={errors}
      originOptions={originOptions}
      preparationOptions={preparationOptions}
      preparationLoading={preparationLoading}
      onPreparationSearchChange={onPreparationSearchChange}
      onPreparationSelect={onPreparationSelect}
      lineColumns={lineColumns}
      showRemove={showRemove}
      onRemove={onRemove}
      onFieldChange={onFieldChange}
      onRowsChange={onRowsChange}
    />
  )
}
