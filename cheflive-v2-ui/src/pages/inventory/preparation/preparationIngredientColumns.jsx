import { MultiSelect } from '../../../components/MultiSelect.jsx'
import { buildIngredientLabel } from '../../utilizations/utilizationFormUtils.js'

/**
 * @param {{
 *   ingredientOptions: { value: string, label: string }[],
 *   ingredientsById: Record<string, { id: number, item_code?: unknown, name?: string, unit?: string }>,
 *   setIngredientSearch: (q: string) => void,
 *   loadUnitOptionsForIngredient: (id: string) => Promise<{ baseUnit: string, unitOptions: { value: string, label: string }[] | null }>,
 * }} opts
 */
export function buildPreparationIngredientColumns(opts) {
  const { ingredientOptions, ingredientsById, setIngredientSearch, loadUnitOptionsForIngredient } = opts

  return [
    {
      key: 'ingredient_id',
      header: 'Ingredient',
      kind: 'custom',
      thClassName: 'min-w-[16rem]',
      render: ({ row, updateCell }) => {
        const selected = row?.ingredient_id ? String(row.ingredient_id) : ''
        let optionsForRow = ingredientOptions
        if (selected && !ingredientOptions.some((o) => String(o.value) === selected)) {
          const cached = ingredientsById[selected]
          const fallbackLabel =
            row?.ingredient_label && String(row.ingredient_label).trim()
              ? String(row.ingredient_label)
              : buildIngredientLabel(cached) || `#${selected}`
          optionsForRow = [{ value: selected, label: fallbackLabel }, ...ingredientOptions]
        }
        return (
          <div className="min-h-9 w-full">
            <MultiSelect
              bare
              options={optionsForRow}
              value={selected}
              placeholder="Select ingredient…"
              isMulti={false}
              onSearchChange={setIngredientSearch}
              onChange={async (next) => {
                const picked = next ? String(next) : ''
                updateCell('ingredient_id', picked)
                const ing = picked ? ingredientsById[picked] : null
                updateCell('ingredient_label', picked ? buildIngredientLabel(ing) : '')
                if (!picked) {
                  updateCell('unit', '')
                  updateCell('unitOptions', null)
                  updateCell('baseUnit', '')
                  return
                }
                const { baseUnit, unitOptions } = await loadUnitOptionsForIngredient(picked)
                updateCell('baseUnit', baseUnit)
                updateCell('unitOptions', unitOptions)
                updateCell('unit', baseUnit || '')
                if (String(row?.qty ?? '').trim() === '') updateCell('qty', '1')
              }}
            />
          </div>
        )
      },
    },
    { key: 'qty', header: 'Qty', kind: 'decimal', thClassName: 'w-24' },
    {
      key: 'unit',
      header: 'Unit',
      kind: 'custom',
      thClassName: 'w-36',
      render: ({ row, updateCell }) => {
        const opts = Array.isArray(row?.unitOptions) ? row.unitOptions : []
        const val = row?.unit === undefined || row?.unit === null ? '' : String(row.unit)
        if (opts.length > 0) {
          return (
            <select
              value={val}
              onChange={(e) => updateCell('unit', e.target.value)}
              className="box-border min-h-9 w-full border-0 bg-transparent px-2 text-sm text-slate-900 outline-none focus:bg-slate-50 focus:ring-2 focus:ring-inset focus:ring-slate-300"
            >
              {opts.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          )
        }
        return (
          <input
            value={val}
            onChange={(e) => updateCell('unit', e.target.value)}
            placeholder="Unit"
            className="box-border min-h-9 w-full border-0 bg-transparent px-2 py-1 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:bg-slate-50 focus:ring-2 focus:ring-inset focus:ring-slate-300"
          />
        )
      },
    },
  ]
}
