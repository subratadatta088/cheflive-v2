import { MultiSelect } from '../../components/MultiSelect.jsx'
import { buildIngredientLabel } from './utilizationFormUtils.js'

/**
 * @param {{
 *   lineReadOnly: boolean,
 *   originId: string,
 *   originOptions: Array<{ id: number, name?: string }>,
 *   defaultOrigin: { id?: number, name?: string } | null,
 *   ingredientOptions: { value: string, label: string }[],
 *   ingredientsById: Record<string, { id: number, item_code?: number|null, name?: string, unit?: string }>,
 *   ingredientsByItemCode: Record<string, { id: number, item_code?: number|null, name?: string, unit?: string }>,
 *   setIngredientSearch: (q: string) => void,
 *   loadConversionsIntoRow: (rowId: string, ingredientId: string|number) => void,
 *   loadDefaultStockIntoRow: (rowId: string, ingredientId: string|number) => void,
 * }} opts
 */
export function buildUtilizationLineColumns(opts) {
  const {
    lineReadOnly,
    originId,
    originOptions,
    defaultOrigin,
    ingredientOptions,
    ingredientsById,
    ingredientsByItemCode,
    setIngredientSearch,
    loadConversionsIntoRow,
    loadDefaultStockIntoRow,
  } = opts

  const originStr = String(originId ?? '').trim()
  const originNum = originStr ? Number(originStr) : NaN
  let currentStockHeaderOrigin = 'Default origin'
  if (Number.isFinite(originNum) && originNum > 0) {
    const o = originOptions.find((x) => Number(x.id) === originNum)
    const name = o?.name != null ? String(o.name).trim() : ''
    currentStockHeaderOrigin = name || `Origin #${originNum}`
  } else if (defaultOrigin?.name) {
    currentStockHeaderOrigin = String(defaultOrigin.name).trim()
  }

  return [
    {
      key: 'item_code',
      header: 'BarCode',
      kind: 'custom',
      thClassName: 'w-50',
      render: ({ row, updateCell }) => {
        const value = row?.item_code === undefined || row?.item_code === null ? '' : String(row.item_code)
        return (
          <input
            readOnly={lineReadOnly}
            value={value}
            onChange={(e) => {
              if (lineReadOnly) return
              const next = String(e.target.value ?? '').replace(/[^\d]/g, '')
              updateCell('item_code', next)
              if (!next) {
                updateCell('ingredient_id', '')
                updateCell('ingredient_label', '')
                updateCell('unit', '')
                updateCell('unitOptions', null)
                void loadDefaultStockIntoRow(row.id, '')
                return
              }
              const ing = ingredientsByItemCode[next]
              if (ing?.id) {
                updateCell('ingredient_id', String(ing.id))
                updateCell('ingredient_label', buildIngredientLabel(ing))
                updateCell('unit', ing?.unit ? String(ing.unit) : '')
                const baseUnit = ing?.unit ? String(ing.unit) : ''
                updateCell('unitOptions', baseUnit ? [{ value: baseUnit, label: baseUnit }] : null)
                updateCell('baseUnit', baseUnit)
                if (String(row?.qty ?? '').trim() === '') updateCell('qty', '1')
                void loadConversionsIntoRow(row.id, ing.id)
                void loadDefaultStockIntoRow(row.id, ing.id)
              }
            }}
            inputMode="numeric"
            autoComplete="off"
            placeholder="Scan/enter"
            className={
              'box-border h-9 w-full min-w-[72px] border-0 px-2 py-1 text-sm tabular-nums outline-none placeholder:text-slate-400 ' +
              (lineReadOnly
                ? 'cursor-default bg-slate-50/80 text-slate-600'
                : 'bg-transparent text-slate-900 focus:bg-slate-50 focus:ring-2 focus:ring-inset focus:ring-slate-300')
            }
          />
        )
      },
    },
    {
      key: 'ingredient_id',
      header: 'Item',
      kind: 'custom',
      thClassName: 'w-80',
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
          <div className="h-9 w-full">
            <MultiSelect
              bare
              isDisabled={lineReadOnly}
              options={optionsForRow}
              value={selected}
              placeholder="Select item…"
              isMulti={false}
              onSearchChange={setIngredientSearch}
              onChange={(next) => {
                if (lineReadOnly) return
                const picked = next ? String(next) : ''
                updateCell('ingredient_id', picked)
                const ing = picked ? ingredientsById[picked] : null
                const code = ing?.item_code === null || ing?.item_code === undefined ? '' : String(ing.item_code)
                updateCell('item_code', code)
                updateCell('ingredient_label', picked ? buildIngredientLabel(ing) : '')
                updateCell('unit', ing?.unit ? String(ing.unit) : '')
                const baseUnit = ing?.unit ? String(ing.unit) : ''
                updateCell('unitOptions', baseUnit ? [{ value: baseUnit, label: baseUnit }] : null)
                updateCell('baseUnit', baseUnit)
                if (ing?.id && String(row?.qty ?? '').trim() === '') updateCell('qty', '1')
                if (ing?.id) {
                  void loadConversionsIntoRow(row.id, ing.id)
                  void loadDefaultStockIntoRow(row.id, ing.id)
                } else {
                  void loadDefaultStockIntoRow(row.id, '')
                }
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
      thClassName: 'w-40',
      render: ({ row, updateCell }) => {
        const opts = Array.isArray(row?.unitOptions) ? row.unitOptions : []
        const val = row?.unit === undefined || row?.unit === null ? '' : String(row.unit)
        if (opts.length > 0) {
          return (
            <select
              disabled={lineReadOnly}
              value={val}
              onChange={(e) => updateCell('unit', e.target.value)}
              className="box-border h-9 w-full border-0 bg-transparent px-2 text-sm text-slate-900 outline-none disabled:cursor-default disabled:bg-slate-50/80 disabled:text-slate-600 focus:bg-slate-50 focus:ring-2 focus:ring-inset focus:ring-slate-300"
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
            readOnly={lineReadOnly}
            value={val}
            onChange={(e) => {
              if (!lineReadOnly) updateCell('unit', e.target.value)
            }}
            placeholder="Unit"
            className={
              'box-border h-9 w-full border-0 px-2 py-1 text-sm outline-none placeholder:text-slate-400 ' +
              (lineReadOnly
                ? 'cursor-default bg-slate-50/80 text-slate-600'
                : 'bg-transparent text-slate-900 focus:bg-slate-50 focus:ring-2 focus:ring-inset focus:ring-slate-300')
            }
          />
        )
      },
    },
    {
      key: 'defaultStockQtyStr',
      header: (
        <span className="flex flex-wrap items-center gap-1.5 whitespace-normal text-left normal-case font-normal tracking-normal">
          <span className="shrink-0 text-[0.65rem] font-bold uppercase text-slate-600">Current stock</span>
          <span
            className="max-w-[10rem] shrink truncate rounded-md bg-amber-100 px-1.5 py-0.5 text-[0.7rem] font-semibold normal-case text-amber-950 ring-1 ring-amber-300/80"
            title={currentStockHeaderOrigin}
          >
            {currentStockHeaderOrigin}
          </span>
        </span>
      ),
      kind: 'custom',
      thClassName: 'min-w-[12rem] align-middle',
      render: ({ row }) => {
        if (!row?.ingredient_id) return <div className="h-9 w-full" />
        const wrap = (children) => (
          <div className="flex h-9 min-h-9 w-full items-center bg-neutral-100 px-2 text-sm tabular-nums">
            {children}
          </div>
        )
        if (row?.defaultStockLoading) return wrap(<span className="text-slate-400">…</span>)
        const qtyStr =
          row?.defaultStockQtyStr === undefined || row?.defaultStockQtyStr === null
            ? ''
            : String(row.defaultStockQtyStr)
        const unitRaw =
          row?.defaultStockUnit === undefined || row?.defaultStockUnit === null
            ? ''
            : String(row.defaultStockUnit).trim()
        if (!qtyStr && !unitRaw) return wrap(null)
        if (qtyStr === '—') return wrap(<span className="font-normal text-slate-600">—</span>)
        return wrap(
          <>
            <span className="font-bold text-slate-900">{qtyStr}</span>
            {unitRaw ? (
              <span className="ms-1 font-normal text-slate-900"> ({unitRaw.toUpperCase()})</span>
            ) : null}
          </>,
        )
      },
    },
  ]
}
