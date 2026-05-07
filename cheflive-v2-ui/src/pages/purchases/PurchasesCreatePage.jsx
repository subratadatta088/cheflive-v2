import { useEffect, useMemo, useState } from 'react'
import { Breadcrumb } from '../../components/Breadcrumb.jsx'
import { Button } from '../../components/Button.jsx'
import { LineItemsGrid } from '../../components/LineItemsGrid.jsx'
import { AddOriginButton } from '../../components/AddOriginButton.jsx'
import { listOrigins } from '../../apis/origin.js'
import { listIngredients, listIngredientUnitConversions } from '../../apis/ingredient.js'
import { MultiSelect } from '../../components/MultiSelect.jsx'

function newRow() {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    item_code: '',
    ingredient_id: '',
    qty: '',
    unit: '',
    unitPrice: '',
    unitOptions: null,
    unitConversions: null,
    baseUnit: '',
    basePrice: '',
  }
}

/** @param {ReturnType<typeof newRow>} row */
function formatLineTotal(row) {
  const q = parseFloat(String(row.qty).replace(',', '.')) || 0
  const p = parseFloat(String(row.unitPrice).replace(',', '.')) || 0
  const t = q * p
  return t ? t.toFixed(2) : ''
}

export function PurchasesCreatePage() {
  const [transferTo, setTransferTo] = useState('')
  const [purchaseDate, setPurchaseDate] = useState('')
  const [originId, setOriginId] = useState('')
  const [originOptions, setOriginOptions] = useState([])
  const [notes, setNotes] = useState('')
  const [vendor, setVendor] = useState('')
  const [rows, setRows] = useState(() => [newRow()])
  const [ingredientOptions, setIngredientOptions] = useState(() => /** @type {{ value: string, label: string }[]} */ ([]))
  const [ingredientsById, setIngredientsById] = useState(
    () => /** @type {Record<string, { id: number, item_code?: number|null, name?: string, unit?: string, base_price?: number|null }>} */ ({}),
  )
  const [ingredientsByItemCode, setIngredientsByItemCode] = useState(
    () => /** @type {Record<string, { id: number, item_code?: number|null, name?: string, unit?: string, base_price?: number|null }>} */ ({}),
  )
  const [ingredientSearch, setIngredientSearch] = useState('')

  async function loadConversionsIntoRow(rowId, ingredientId) {
    const ingKey = ingredientId ? String(ingredientId) : ''
    const rowKey = String(rowId)
    if (!ingKey) return

    try {
      const data = await listIngredientUnitConversions(ingKey)
      const items = Array.isArray(data?.items) ? data.items : []

      const baseUnit = ingredientsById?.[ingKey]?.unit ? String(ingredientsById[ingKey].unit) : ''
      const units = []
      if (baseUnit) units.push(baseUnit)
      for (const c of items) {
        const from = c?.from_unit ? String(c.from_unit) : ''
        const to = c?.to_unit ? String(c.to_unit) : ''
        if (from) units.push(from)
        if (to) units.push(to)
      }
      const uniq = [...new Set(units)]
      const opts = uniq.length ? uniq.map((u) => ({ value: u, label: u })) : null

      setRows((prev) =>
        prev.map((r) => {
          if (String(r.id) !== rowKey) return r
          // If user already changed ingredient since request started, ignore.
          if (String(r.ingredient_id ?? '') !== ingKey) return r
          const nextUnit = baseUnit || String(r.unit ?? '')
          return { ...r, unitOptions: opts, unitConversions: items, unit: nextUnit }
        }),
      )
    } catch (e) {
      // Non-fatal: leave unitOptions empty (no fake fallback)
      console.error('[Unit conversions load failed]', e)
    }
  }

  function applyUnitPriceForRow(row, nextUnit) {
    const baseUnit = String(row?.baseUnit ?? row?.unit ?? '').trim()
    const basePriceNum = Number(String(row?.basePrice ?? '').trim())
    if (!baseUnit || !Number.isFinite(basePriceNum)) return null

    const unit = String(nextUnit ?? '').trim()
    if (!unit) return null

    if (unit === baseUnit) return String(basePriceNum)

    const convs = Array.isArray(row?.unitConversions) ? row.unitConversions : []
    const direct = convs.find((c) => String(c?.from_unit ?? '') === unit && String(c?.to_unit ?? '') === baseUnit)
    if (direct && Number.isFinite(Number(direct.factor)) && Number(direct.factor) > 0) {
      // 1 (unit) = factor * (baseUnit) => pricePerUnit = basePrice * factor
      return String(basePriceNum * Number(direct.factor))
    }

    const inverse = convs.find((c) => String(c?.from_unit ?? '') === baseUnit && String(c?.to_unit ?? '') === unit)
    if (inverse && Number.isFinite(Number(inverse.factor)) && Number(inverse.factor) > 0) {
      // 1 (baseUnit) = factor * (unit) => 1 (unit) = (1/factor) * (baseUnit)
      return String(basePriceNum / Number(inverse.factor))
    }

    return null
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        // is active true. a boolean value.
        const { items } = await listOrigins({ limit: 100, is_active: true })
        if (cancelled) return
        const opts = items.map((o) => ({
          id: o?.id,
          name: o?.name ?? '',
          is_default: Number(o?.is_default ?? 0) === 1,
        }))
        setOriginOptions(opts)

        setOriginId((prev) => {
          if (prev) return prev
          const def = opts.find((o) => o.is_default && o.id)
          const first = opts.find((o) => o.id)
          return def?.id ? String(def.id) : first?.id ? String(first.id) : ''
        })
      } catch (e) {
        if (cancelled) return
        console.error('[Origins load failed]', e)
        setOriginOptions([])
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const t = setTimeout(() => {
      ;(async () => {
        try {
          const q = ingredientSearch.trim() || undefined
          const { items } = await listIngredients({
            q,
            limit: 20
          })
          if (cancelled) return

          const byId = {}
          const byCode = {}
          for (const it of Array.isArray(items) ? items : []) {
            const id = Number(it?.id)
            if (!Number.isFinite(id) || id <= 0) continue
            const row = {
              id,
              item_code: it?.item_code ?? null,
              name: it?.name ?? '',
              unit: it?.unit ?? '',
              base_price: it?.base_price ?? null,
            }
            byId[String(id)] = row

            const code = row.item_code === null || row.item_code === undefined ? '' : String(row.item_code)
            if (code) byCode[code] = row
          }

          const opts = Object.values(byId).map((x) => ({
            value: String(x.id),
            label: `${x.name || 'Unnamed'}${x.item_code ? ` (${x.item_code})` : ''}`,
          }))

          setIngredientsById(byId)
          setIngredientsByItemCode(byCode)
          setIngredientOptions(opts)
        } catch (e) {
          if (cancelled) return
          console.error('[Ingredients load failed]', e)
          setIngredientsById({})
          setIngredientsByItemCode({})
          setIngredientOptions([])
        }
      })()
    }, 250)

    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [ingredientSearch])

  const purchaseColumns = useMemo(
    () => [
      {
        key: 'item_code',
        header: 'Item code',
        kind: 'custom',
        thClassName: 'w-80',
        render: ({ row, updateCell }) => {
          const value = row?.item_code === undefined || row?.item_code === null ? '' : String(row.item_code)
          return (
            <input
              value={value}
              onChange={(e) => {
                const next = String(e.target.value ?? '').replace(/[^\d]/g, '')
                updateCell('item_code', next)

                if (!next) {
                  updateCell('ingredient_id', '')
                  updateCell('unit', '')
                  updateCell('unitOptions', null)
                  updateCell('unitPrice', '')
                  return
                }

                const ing = ingredientsByItemCode[next]
                if (ing?.id) {
                  updateCell('ingredient_id', String(ing.id))
                  updateCell('unit', ing?.unit ? String(ing.unit) : '')

                  // Seed options with base unit immediately; conversions load async.
                  const baseUnit = ing?.unit ? String(ing.unit) : ''
                  updateCell('unitOptions', baseUnit ? [{ value: baseUnit, label: baseUnit }] : null)
                  updateCell('unitConversions', null)
                  updateCell('baseUnit', baseUnit)
                  const basePrice = ing?.base_price === null || ing?.base_price === undefined ? '' : String(ing.base_price)
                  updateCell('basePrice', basePrice)

                  const hasQty = String(row?.qty ?? '').trim() !== ''
                  if (!hasQty) updateCell('qty', '1')

                  const hasPrice = String(row?.unitPrice ?? '').trim() !== ''
                  if (!hasPrice && basePrice !== '') updateCell('unitPrice', basePrice)

                  void loadConversionsIntoRow(row.id, ing.id)
                }
              }}
              inputMode="numeric"
              autoComplete="off"
              placeholder="Scan/enter"
              className="box-border h-9 w-full min-w-[72px] border-0 bg-transparent px-2 py-1 text-sm tabular-nums text-slate-900 outline-none placeholder:text-slate-400 focus:bg-slate-50 focus:ring-2 focus:ring-inset focus:ring-slate-300"
            />
          )
        },
      },
      {
        key: 'ingredient_id',
        header: 'Item',
        kind: 'custom',
        thClassName: 'min-w-[260px]',
        align: 'left',
        render: ({ row, updateCell }) => {
          const selected = row?.ingredient_id ? String(row.ingredient_id) : ''
          return (
            <div className="px-2 py-0.5">
              <MultiSelect
                options={ingredientOptions}
                value={selected}
                placeholder="Select item…"
                isMulti={false}
                onSearchChange={(q) => setIngredientSearch(q)}
                onChange={(next) => {
                  const picked = next ? String(next) : ''
                  updateCell('ingredient_id', picked)

                  const ing = picked ? ingredientsById[picked] : null
                  const code = ing?.item_code === null || ing?.item_code === undefined ? '' : String(ing.item_code)
                  updateCell('item_code', code)
                  updateCell('unit', ing?.unit ? String(ing.unit) : '')

                  const baseUnit = ing?.unit ? String(ing.unit) : ''
                  updateCell('unitOptions', baseUnit ? [{ value: baseUnit, label: baseUnit }] : null)
                  updateCell('unitConversions', null)
                  updateCell('baseUnit', baseUnit)
                  const basePrice = ing?.base_price === null || ing?.base_price === undefined ? '' : String(ing.base_price)
                  updateCell('basePrice', basePrice)

                  const hasQty = String(row?.qty ?? '').trim() !== ''
                  if (ing?.id && !hasQty) updateCell('qty', '1')

                  const hasPrice = String(row?.unitPrice ?? '').trim() !== ''
                  if (ing?.id && !hasPrice && basePrice !== '') updateCell('unitPrice', basePrice)

                  if (ing?.id) void loadConversionsIntoRow(row.id, ing.id)
                  if (!ing?.id) {
                    updateCell('unit', '')
                    updateCell('unitOptions', null)
                    updateCell('unitConversions', null)
                    updateCell('baseUnit', '')
                    updateCell('basePrice', '')
                    updateCell('unitPrice', '')
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
        thClassName: 'w-28',
        render: ({ row, updateCell }) => {
          const opts = Array.isArray(row?.unitOptions) && row.unitOptions.length ? row.unitOptions : []
          const value = row?.unit === undefined || row?.unit === null ? '' : String(row.unit)

          // Don’t show fake units when nothing selected.
          if (!row?.ingredient_id || opts.length === 0) return <div className="h-9 w-full" />

          return (
            <select
              value={value}
              onChange={(e) => {
                const next = e.target.value
                updateCell('unit', next)
                const nextPrice = applyUnitPriceForRow(row, next)
                if (nextPrice !== null) updateCell('unitPrice', nextPrice)
              }}
              className="box-border h-9 w-full border-0 bg-transparent px-2 text-sm text-slate-900 outline-none focus:bg-slate-50 focus:ring-2 focus:ring-inset focus:ring-slate-300"
            >
              {opts.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          )
        },
      },
      { key: 'unitPrice', header: 'Unit price', kind: 'decimal', thClassName: 'w-28' },
      {
        key: '__lineTotal',
        header: 'Line total',
        kind: 'computed',
        thClassName: 'w-32',
        compute: (row) => formatLineTotal(row),
      },
    ],
    [ingredientOptions, ingredientsById, ingredientsByItemCode],
  )

  const grandTotal = useMemo(() => {
    return rows.reduce((sum, r) => {
      const q = parseFloat(String(r.qty).replace(',', '.')) || 0
      const p = parseFloat(String(r.unitPrice).replace(',', '.')) || 0
      return sum + q * p
    }, 0)
  }, [rows])

  return (
    <section className="space-y-4">
      <Breadcrumb items={[{ label: 'Purchases' }, { label: 'Create' }]} />

      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-slate-900">Create purchase</h2>
        <AddOriginButton />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <label className="space-y-1">
          <span className="text-sm font-medium text-slate-700">Date of purchase</span>
          <input
            type="date"
            value={purchaseDate}
            onChange={(e) => setPurchaseDate(e.target.value)}
            className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-300"
          />
        </label>
        <label className="space-y-1">
          <span className="text-sm font-medium text-slate-700">Received To</span>
          <select
            value={originId}
            onChange={(e) => setOriginId(e.target.value)}
            className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-300"
          >
            {originOptions.length === 0 ? (
              <option value="">No origins found</option>
            ) : (
              originOptions.map((o) => (
                <option key={o.id} value={String(o.id)}>
                  {o.name}
                </option>
              ))
            )}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-sm font-medium text-slate-700">
            Transfer To <span className="font-normal text-slate-500">(optional)</span>
          </span>
          <select
            value={transferTo}
            onChange={(e) => setTransferTo(e.target.value)}
            className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-300"
          >
            <option value="">Select destination…</option>
            {originOptions.length === 0 ? (
              <option value="" disabled>
                No origins found
              </option>
            ) : (
              originOptions.map((o) => (
                <option key={o.id} value={String(o.id)}>
                  {o.name}
                </option>
              ))
            )}
          </select>
        </label>
        {/* <label className="space-y-1">
          <span className="text-sm font-medium text-slate-700">
            Vendor <span className="font-normal text-slate-500">(optional)</span>
          </span>
          <input
            type="text"
            value={vendor}
            onChange={(e) => setVendor(e.target.value)}
            placeholder="Vendor name"
            className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300"
          />
        </label> */}
        <label className="space-y-1 sm:col-span-3">
          <span className="text-sm font-medium text-slate-700">
            Notes <span className="font-normal text-slate-500">(optional)</span>
          </span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Notes"
            className="w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300"
          />
        </label>
      </div>

      <LineItemsGrid
        rows={rows}
        onRowsChange={setRows}
        createRow={newRow}
        columns={purchaseColumns}
        footer={{
          label: 'Total',
          value: grandTotal.toFixed(2),
          leadingColumnsSpan: 6,
        }}
      />

      <div className="flex justify-end pt-2">
        <Button
          variant="primary"
          type="button"
          onClick={() => {
            // TODO: POST purchase payload
            console.warn('[Purchase save]', {
              transferTo,
              purchaseDate,
              origin_id: originId ? Number(originId) : null,
              vendor,
              notes,
              rows,
              grandTotal,
            })
            alert('Purchase saved (mock).')
          }}
        >
          Save
        </Button>
      </div>
    </section>
  )
}
