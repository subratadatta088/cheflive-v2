import { MultiSelect } from '../../../components/MultiSelect.jsx'

/**
 * @param {{ ingredientOptions: { value: string, label: string }[] }} opts
 */
export function buildStockAdjustColumns({ ingredientOptions }) {
  return [
    {
      key: 'ingredient_id',
      header: 'Ingredient',
      kind: 'custom',
      thClassName: 'min-w-[220px]',
      render: ({ row, updateCell }) => {
        const value = row?.ingredient_id ? String(row.ingredient_id) : ''
        return (
          <MultiSelect
            bare
            isMulti={false}
            options={ingredientOptions}
            value={value}
            onChange={(next) => {
              const id = next ? String(next) : ''
              updateCell('ingredient_id', id)
              const opt = ingredientOptions.find((o) => String(o.value) === id)
              updateCell('ingredient_label', opt?.label ? String(opt.label) : '')
              if (!id) {
                updateCell('current_stock', '')
                updateCell('adjusted_stock', '')
                updateCell('unit', '')
              }
            }}
            placeholder="Select ingredient…"
          />
        )
      },
    },
    {
      key: 'current_stock',
      header: 'Current stock',
      kind: 'custom',
      thClassName: 'w-[140px]',
      render: ({ row }) => {
        const qty = String(row?.current_stock ?? '').trim()
        const unit = String(row?.unit ?? '').trim()
        const display = qty ? (unit ? `${qty} ${unit}` : qty) : '—'
        return <span className="block px-2 py-1 text-sm tabular-nums text-slate-600">{display}</span>
      },
    },
    {
      key: 'adjusted_stock',
      header: 'Adjusted stock',
      kind: 'decimal',
      thClassName: 'w-[120px]',
      placeholder: '0',
    },
    {
      key: 'remarks',
      header: 'Remarks',
      kind: 'text',
      placeholder: 'Optional note',
    },
  ]
}
