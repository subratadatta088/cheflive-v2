import { useMemo } from 'react'
import { LineItemsGrid } from '../../../components/LineItemsGrid.jsx'
import { PreparationFormFields } from './PreparationFormFields.jsx'
import { buildPreparationIngredientColumns } from './preparationIngredientColumns.jsx'
import { newPreparationIngredientRow } from './preparationFormUtils.js'
import { usePreparationIngredientLookup } from './usePreparationIngredientLookup.js'

/**
 * @param {{
 *   form: { name: string, type: string, unit: string, tags: string, is_active: boolean, rows: unknown[] },
 *   errors?: Record<string, string>,
 *   disabled?: boolean,
 *   onFieldChange: (field: string, value: string | boolean) => void,
 *   onRowsChange: import('react').Dispatch<import('react').SetStateAction<unknown[]>>,
 *   seedIngredientsById?: Record<string, unknown>,
 * }} props
 */
export function PreparationForm({
  form,
  errors = {},
  disabled = false,
  onFieldChange,
  onRowsChange,
  seedIngredientsById = {},
}) {
  const {
    ingredientOptions,
    ingredientsById,
    setIngredientSearch,
    loadUnitOptionsForIngredient,
  } = usePreparationIngredientLookup(seedIngredientsById)

  const columns = useMemo(
    () =>
      buildPreparationIngredientColumns({
        ingredientOptions,
        ingredientsById,
        setIngredientSearch,
        loadUnitOptionsForIngredient,
      }),
    [ingredientOptions, ingredientsById, loadUnitOptionsForIngredient],
  )

  return (
    <div className="space-y-4">
      <PreparationFormFields
        values={form}
        errors={errors}
        disabled={disabled}
        onChange={onFieldChange}
      />

      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-slate-900">
          Ingredients <span className="font-normal text-slate-500">(per 1 {form.unit || 'unit'})</span>
        </h3>
        <LineItemsGrid
          rows={form.rows}
          onRowsChange={onRowsChange}
          createRow={newPreparationIngredientRow}
          columns={columns}
          showIndexColumn={false}
          rowActionsHeader="Rows"
        />
        {errors.items ? (
          <p className="text-xs text-red-600" role="alert">
            {errors.items}
          </p>
        ) : null}
      </div>
    </div>
  )
}
