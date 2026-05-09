import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useFormik } from 'formik'
import { z } from 'zod'
import { RotateCcw, Save } from 'lucide-react'
import { Breadcrumb } from '../../components/Breadcrumb.jsx'
import { Button } from '../../components/Button.jsx'
import { LineItemsGrid } from '../../components/LineItemsGrid.jsx'
import { AddOriginButton } from '../../components/AddOriginButton.jsx'
import { listOrigins } from '../../apis/origin.js'
import {
  getIngredientRunningStockDefault,
  listIngredients,
  listIngredientUnitConversions,
} from '../../apis/ingredient.js'
import { createPurchase } from '../../apis/purchase.js'
import { MultiSelect } from '../../components/MultiSelect.jsx'
import { useToast } from '../../components/Toaster.jsx'
import { usePurchaseCreateShortcuts } from '../../shortcuts/usePurchaseCreateShortcuts.js'
import {
  blurPurchaseLineField,
  PURCHASE_FIELD_INGREDIENT_ID,
  PURCHASE_FIELD_ITEM_CODE,
} from '../../shortcuts/purchaseCreateDom.js'

function newRow() {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    item_code: '',
    ingredient_id: '',
    ingredient_label: '',
    qty: '',
    unit: '',
    unitPrice: '',
    unitOptions: null,
    unitConversions: null,
    baseUnit: '',
    basePrice: '',
    defaultStockQtyStr: '',
    defaultStockUnit: '',
    defaultStockLoading: false,
  }
}

/** @param {unknown} qty @param {unknown} unit @returns {{ qtyStr: string, unitStr: string } | null} */
function parseDefaultStockParts(qty, unit) {
  const u = unit === undefined || unit === null ? '' : String(unit).trim()
  const raw = qty === undefined || qty === null ? NaN : Number(qty)
  if (!Number.isFinite(raw)) return null
  const qStr = raw % 1 === 0 ? String(raw) : String(raw)
  return { qtyStr: qStr, unitStr: u }
}

/** Local calendar date for `<input type="date" />` (YYYY-MM-DD). */
function todayLocalDate() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function zodToFormikErrors(zodError) {
  /** @type {Record<string, string>} */
  const out = {}
  for (const issue of zodError.issues ?? []) {
    const key = issue.path?.[0]
    if (!key) continue
    if (out[key]) continue
    out[String(key)] = issue.message
  }
  return out
}

const PurchaseFormSchema = z
  .object({
    purchaseDate: z.string().min(1, 'Please pick a purchase date.'),
    originId: z.string().refine(
      (s) => {
        const n = Number(s)
        return Number.isFinite(n) && n > 0
      },
      { message: 'Please select a Received To origin.' },
    ),
    transferTo: z.string().optional(),
    notes: z.string().optional(),
    rows: z.array(z.any()),
  })
  .superRefine((data, ctx) => {
    for (const r of data.rows) {
      const ingId = Number(r?.ingredient_id)
      const qty = parseFloat(String(r?.qty ?? '').replace(',', '.'))
      if (!Number.isFinite(ingId) || ingId <= 0) continue
      if (!Number.isFinite(qty) || qty <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Each line with an item needs a positive qty.',
          path: ['items'],
        })
        return
      }
    }

    const hasLine = data.rows.some((r) => {
      const ingId = Number(r?.ingredient_id)
      const qty = parseFloat(String(r?.qty ?? '').replace(',', '.'))
      return Number.isFinite(ingId) && ingId > 0 && Number.isFinite(qty) && qty > 0
    })
    if (!hasLine) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Add at least one line item with an item and qty.',
        path: ['items'],
      })
    }
  })

function buildIngredientLabel(ing) {
  if (!ing) return ''
  const name = ing?.name ? String(ing.name) : 'Unnamed'
  const code = ing?.item_code === null || ing?.item_code === undefined ? '' : String(ing.item_code)
  return code ? `${name} (${code})` : name
}

/** @param {ReturnType<typeof newRow>} row */
function formatLineTotal(row) {
  const q = parseFloat(String(row.qty).replace(',', '.')) || 0
  const p = parseFloat(String(row.unitPrice).replace(',', '.')) || 0
  const t = q * p
  return t ? t.toFixed(2) : ''
}

/** @param {{ id: unknown, is_default?: boolean }[]} originOptions */
function buildFreshPurchaseValues(originOptions) {
  const nextOrigin =
    originOptions.find((o) => o.is_default && o.id)?.id ??
    originOptions.find((o) => o.id)?.id ??
    ''
  return {
    purchaseDate: todayLocalDate(),
    originId: nextOrigin ? String(nextOrigin) : '',
    transferTo: '',
    notes: '',
    rows: [newRow()],
  }
}

export function PurchasesCreatePage() {
  const { showToast } = useToast()
  const [originOptions, setOriginOptions] = useState([])
  /** Full Formik snapshot (async origins effect). */
  const valuesRef = useRef(null)
  /**
   * Mirrors `rows` synchronously so chained `onRowsChange(prev => …)` updates work.
   * Formik `setFieldValue` does not queue functional updaters like React `setState`.
   */
  const rowsRef = useRef(null)
  const isSubmittingRef = useRef(false)

  const formik = useFormik({
    initialValues: {
      purchaseDate: todayLocalDate(),
      originId: '',
      transferTo: '',
      notes: '',
      rows: [newRow()],
    },
    validateOnChange: false,
    validateOnBlur: false,
    validateOnMount: false,
    validate: (values) => {
      const res = PurchaseFormSchema.safeParse(values)
      if (res.success) return {}
      return zodToFormikErrors(res.error)
    },
    onSubmit: async (values, helpers) => {
      helpers.setStatus(undefined)
      const originIdNum = Number(values.originId)
      const items = []
      for (const r of values.rows) {
        const ingId = Number(r?.ingredient_id)
        const qty = parseFloat(String(r?.qty ?? '').replace(',', '.'))
        if (!Number.isFinite(ingId) || ingId <= 0) continue
        if (!Number.isFinite(qty) || qty <= 0) continue

        const item = { ingredient_id: ingId, qty }

        const unit = String(r?.unit ?? '').trim()
        if (unit) item.unit = unit

        const unitPrice = parseFloat(String(r?.unitPrice ?? '').replace(',', '.'))
        if (Number.isFinite(unitPrice) && unitPrice >= 0) item.unit_price = unitPrice

        items.push(item)
      }

      const payload = {
        origin_id: originIdNum,
        date: values.purchaseDate,
        items,
      }

      const note = String(values.notes ?? '').trim()
      if (note) payload.note = note

      const transferToNum = values.transferTo ? Number(values.transferTo) : NaN
      if (Number.isFinite(transferToNum) && transferToNum > 0) {
        payload.transfer_to = transferToNum
      }

      helpers.setSubmitting(true)
      try {
        const data = await createPurchase(payload)
        console.info('[Purchase created]', data)
        helpers.resetForm({ values: buildFreshPurchaseValues(originOptions) })
        showToast({ text: 'Purchase saved successfully.', theme: 'success', duration: 5000 })
      } catch (e) {
        const apiMsg = e?.response?.data?.error || e?.message || 'Failed to save purchase.'
        console.error('[Purchase save failed]', e)
        helpers.setStatus(String(apiMsg))
      } finally {
        helpers.setSubmitting(false)
      }
    },
  })

  valuesRef.current = formik.values
  rowsRef.current = formik.values.rows
  isSubmittingRef.current = formik.isSubmitting

  function setRows(updater) {
    const prev = Array.isArray(rowsRef.current) ? rowsRef.current : formik.values.rows ?? []
    const next = typeof updater === 'function' ? updater(prev) : updater
    rowsRef.current = next
    formik.setFieldValue('rows', next)
  }

  function clearFieldError(key) {
    formik.setFieldError(key, undefined)
  }

  const handleResetPurchaseForm = useCallback(() => {
    formik.resetForm({ values: buildFreshPurchaseValues(originOptions) })
    formik.setStatus(undefined)
  }, [originOptions, formik.resetForm, formik.setStatus])

  usePurchaseCreateShortcuts({
    rowsRef,
    setRows,
    newRow,
    clearFieldError,
    isSubmittingRef,
  })

  const [ingredientOptions, setIngredientOptions] = useState(() => /** @type {{ value: string, label: string }[]} */ ([]))
  const [ingredientsById, setIngredientsById] = useState(
    () => /** @type {Record<string, { id: number, item_code?: number|null, name?: string, unit?: string, base_price?: number|null }>} */ ({}),
  )
  const [ingredientsByItemCode, setIngredientsByItemCode] = useState(
    () => /** @type {Record<string, { id: number, item_code?: number|null, name?: string, unit?: string, base_price?: number|null }>} */ ({}),
  )
  const [ingredientSearch, setIngredientSearch] = useState('')

  const loadConversionsIntoRow = useCallback(
    async (rowId, ingredientId) => {
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

        const prev = Array.isArray(rowsRef.current) ? rowsRef.current : formik.values.rows ?? []
        const nextRows = prev.map((r) => {
          if (String(r.id) !== rowKey) return r
          if (String(r.ingredient_id ?? '') !== ingKey) return r
          const nextUnit = baseUnit || String(r.unit ?? '')
          return { ...r, unitOptions: opts, unitConversions: items, unit: nextUnit }
        })
        rowsRef.current = nextRows
        formik.setFieldValue('rows', nextRows)
      } catch (e) {
        console.error('[Unit conversions load failed]', e)
      }
    },
    [ingredientsById, formik.setFieldValue],
  )

  const loadDefaultStockIntoRow = useCallback(
    async (rowId, ingredientId) => {
      const rowKey = String(rowId)
      const ingKey = ingredientId ? String(ingredientId) : ''

      const patchRows = (mapper) => {
        const prev = Array.isArray(rowsRef.current) ? rowsRef.current : []
        const nextRows = prev.map(mapper)
        rowsRef.current = nextRows
        formik.setFieldValue('rows', nextRows)
      }

      if (!ingKey) {
        patchRows((r) =>
          String(r.id) === rowKey
            ? { ...r, defaultStockQtyStr: '', defaultStockUnit: '', defaultStockLoading: false }
            : r,
        )
        return
      }

      patchRows((r) =>
        String(r.id) === rowKey && String(r.ingredient_id ?? '') === ingKey
          ? { ...r, defaultStockLoading: true, defaultStockQtyStr: '', defaultStockUnit: '' }
          : r,
      )

      try {
        const data = await getIngredientRunningStockDefault(ingKey)
        const parts = parseDefaultStockParts(data?.qty, data?.unit)
        patchRows((r) => {
          if (String(r.id) !== rowKey) return r
          if (String(r.ingredient_id ?? '') !== ingKey) return r
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
      } catch (e) {
        console.error('[Default stock load failed]', e)
        patchRows((r) => {
          if (String(r.id) !== rowKey) return r
          if (String(r.ingredient_id ?? '') !== ingKey) return r
          return { ...r, defaultStockQtyStr: '—', defaultStockUnit: '', defaultStockLoading: false }
        })
      }
    },
    [formik.setFieldValue],
  )

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

        const def = opts.find((o) => o.is_default && o.id)
        const first = opts.find((o) => o.id)
        const pick = def?.id ? String(def.id) : first?.id ? String(first.id) : ''
        if (pick && !valuesRef.current?.originId) {
          formik.setFieldValue('originId', pick)
        }
      } catch (e) {
        if (cancelled) return
        console.error('[Origins load failed]', e)
        setOriginOptions([])
      }
    })()

    return () => {
      cancelled = true
    }
    // Origins once on mount; default origin applied only if still empty.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional single fetch
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

          const fresh = []
          const byIdDelta = {}
          const byCodeDelta = {}
          for (const it of Array.isArray(items) ? items : []) {
            const id = Number(it?.id)
            if (!Number.isFinite(id) || id <= 0) continue
            const ing = {
              id,
              item_code: it?.item_code ?? null,
              name: it?.name ?? '',
              unit: it?.unit ?? '',
              base_price: it?.base_price ?? null,
            }
            byIdDelta[String(id)] = ing
            const code = ing.item_code === null || ing.item_code === undefined ? '' : String(ing.item_code)
            if (code) byCodeDelta[code] = ing
            fresh.push(ing)
          }

          const opts = fresh.map((x) => ({
            value: String(x.id),
            label: buildIngredientLabel(x),
          }))

          // Accumulate caches so previously-selected rows can still resolve their label
          // and unit/base_price metadata, even if a later search no longer returns them.
          setIngredientsById((prev) => ({ ...prev, ...byIdDelta }))
          setIngredientsByItemCode((prev) => ({ ...prev, ...byCodeDelta }))
          // Dropdown menu reflects only the current search result.
          setIngredientOptions(opts)
        } catch (e) {
          if (cancelled) return
          console.error('[Ingredients load failed]', e)
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
        header: 'BarCode',
        kind: 'custom',
        thClassName: 'w-50',
        render: ({ row, updateCell }) => {
          const value = row?.item_code === undefined || row?.item_code === null ? '' : String(row.item_code)
          return (
            <input
              data-purchase-line-row={row.id}
              data-purchase-line-field={PURCHASE_FIELD_ITEM_CODE}
              value={value}
              onChange={(e) => {
                const next = String(e.target.value ?? '').replace(/[^\d]/g, '')
                updateCell('item_code', next)

                if (!next) {
                  updateCell('ingredient_id', '')
                  updateCell('ingredient_label', '')
                  updateCell('unit', '')
                  updateCell('unitOptions', null)
                  updateCell('unitPrice', '')
                  void loadDefaultStockIntoRow(row.id, '')
                  return
                }

                const ing = ingredientsByItemCode[next]
                if (ing?.id) {
                  updateCell('ingredient_id', String(ing.id))
                  updateCell('ingredient_label', buildIngredientLabel(ing))
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
                  void loadDefaultStockIntoRow(row.id, ing.id)
                  queueMicrotask(() => blurPurchaseLineField(row.id, PURCHASE_FIELD_ITEM_CODE))
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
        thClassName: 'w-80',
        align: 'left',
        render: ({ row, updateCell }) => {
          const selected = row?.ingredient_id ? String(row.ingredient_id) : ''

          // Each row needs an options list that contains its own selection,
          // even when the global search has filtered it out (or returned no
          // matches). Otherwise react-select can't find the option and the
          // label disappears from this row when another row is being searched.
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
            <div
              className="h-9 w-full"
              data-purchase-line-row={row.id}
              data-purchase-line-field={PURCHASE_FIELD_INGREDIENT_ID}
            >
              <MultiSelect
                bare
                options={optionsForRow}
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
                  updateCell('ingredient_label', picked ? buildIngredientLabel(ing) : '')
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

                  if (ing?.id) {
                    void loadConversionsIntoRow(row.id, ing.id)
                    void loadDefaultStockIntoRow(row.id, ing.id)
                  }
                  if (!ing?.id) {
                    updateCell('ingredient_label', '')
                    updateCell('unit', '')
                    updateCell('unitOptions', null)
                    updateCell('unitConversions', null)
                    updateCell('baseUnit', '')
                    updateCell('basePrice', '')
                    updateCell('unitPrice', '')
                    void loadDefaultStockIntoRow(row.id, '')
                  }
                  queueMicrotask(() => blurPurchaseLineField(row.id, PURCHASE_FIELD_INGREDIENT_ID))
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
      {
        key: 'defaultStockQtyStr',
        header: 'Current Stock',
        kind: 'custom',
        thClassName: 'w-50',
        render: ({ row }) => {
          if (!row?.ingredient_id) return <div className="h-9 w-full" />
          const wrap = (children) => (
            <div className="flex h-9 min-h-9 w-full items-center bg-neutral-100 px-2 text-sm tabular-nums">
              {children}
            </div>
          )
          if (row?.defaultStockLoading) {
            return wrap(<span className="text-slate-400">…</span>)
          }
          const qtyStr =
            row?.defaultStockQtyStr === undefined || row?.defaultStockQtyStr === null
              ? ''
              : String(row.defaultStockQtyStr)
          const unitRaw =
            row?.defaultStockUnit === undefined || row?.defaultStockUnit === null
              ? ''
              : String(row.defaultStockUnit).trim()
          if (!qtyStr && !unitRaw) return wrap(null)
          if (qtyStr === '—') {
            return wrap(<span className="font-normal text-slate-600">—</span>)
          }
          const showUnit = unitRaw.length > 0
          return wrap(
            <>
              <span className="font-bold text-slate-900">{qtyStr}</span>
              {showUnit ? (
                <span className="font-normal text-slate-900 ms-1">
                  {' '}
                  ({unitRaw.toUpperCase()})
                </span>
              ) : null}
            </>,
          )
        },
      },
    ],
    [
      ingredientOptions,
      ingredientsById,
      ingredientsByItemCode,
      loadConversionsIntoRow,
      loadDefaultStockIntoRow,
    ],
  )

  const grandTotal = useMemo(() => {
    return formik.values.rows.reduce((sum, r) => {
      const q = parseFloat(String(r.qty).replace(',', '.')) || 0
      const p = parseFloat(String(r.unitPrice).replace(',', '.')) || 0
      return sum + q * p
    }, 0)
  }, [formik.values.rows])

  return (
    <section className="space-y-4">
      <Breadcrumb items={[{ label: 'Purchases' }, { label: 'Create' }]} />

      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-slate-900">Create purchase</h2>
        <AddOriginButton />
      </div>

      <form
        onSubmit={formik.handleSubmit}
        className="space-y-4"
        data-purchase-create-form=""
      >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <label className="space-y-1">
          <span className="text-sm font-medium text-slate-900 ms-1">Date of purchase</span>
          <input
            type="date"
            name="purchaseDate"
            value={formik.values.purchaseDate}
            onChange={(e) => {
              formik.handleChange(e)
              clearFieldError('purchaseDate')
            }}
            onBlur={formik.handleBlur}
            aria-invalid={Boolean(formik.errors.purchaseDate)}
            className={
              'h-10 w-full rounded-lg border bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 ' +
              (formik.errors.purchaseDate
                ? 'border-red-400 focus:ring-red-300'
                : 'border-slate-200 focus:ring-slate-300')
            }
          />
          {formik.errors.purchaseDate ? (
            <p className="text-xs text-red-600" role="alert">
              {formik.errors.purchaseDate}
            </p>
          ) : null}
        </label>
        <label className="space-y-1">
          <span className="text-sm font-medium text-slate-900 ms-1">Received To</span>
          <select
            name="originId"
            value={formik.values.originId}
            onChange={(e) => {
              formik.handleChange(e)
              clearFieldError('originId')
            }}
            onBlur={formik.handleBlur}
            aria-invalid={Boolean(formik.errors.originId)}
            className={
              'h-10 w-full rounded-lg border bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 ' +
              (formik.errors.originId
                ? 'border-red-400 focus:ring-red-300'
                : 'border-slate-200 focus:ring-slate-300')
            }
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
          {formik.errors.originId ? (
            <p className="text-xs text-red-600" role="alert">
              {formik.errors.originId}
            </p>
          ) : null}
        </label>
        <label className="space-y-1">
          <span className="text-sm font-medium text-slate-900 ms-1">
            Transfer To <span className="font-normal text-slate-500">(optional)</span>
          </span>
          <select
            name="transferTo"
            value={formik.values.transferTo}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
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
          <span className="text-sm font-medium text-slate-900 ms-1">
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
          <span className="text-sm font-medium text-slate-900 ms-1">
            Notes <span className="font-normal text-slate-500">(optional)</span>
          </span>
          <textarea
            name="notes"
            value={formik.values.notes}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            rows={3}
            placeholder="Notes"
            className="w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300"
          />
        </label>
      </div>

      <div className="space-y-1">
        <LineItemsGrid
          rows={formik.values.rows}
          onRowsChange={(updater) => {
            setRows(updater)
            clearFieldError('items')
          }}
          createRow={newRow}
          columns={purchaseColumns}
          footer={{
            label: 'Total',
            value: grandTotal.toFixed(2),
            leadingColumnsSpan: 6,
            blankCellsBeforeActions: 1,
          }}
        />
        {formik.errors.items ? (
          <p className="text-xs text-red-600" role="alert">
            {formik.errors.items}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col items-end gap-2 pt-2">
        {formik.status ? (
          <p className="text-sm text-red-600" role="alert">
            {formik.status}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button type="button" variant="secondary" disabled={formik.isSubmitting} onClick={handleResetPurchaseForm}>
            <RotateCcw className="h-4 w-4 shrink-0" aria-hidden="true" />
            Reset
          </Button>
          <Button variant="dark" type="submit" disabled={formik.isSubmitting}>
            <Save className="h-4 w-4 shrink-0" aria-hidden="true" />
            {formik.isSubmitting ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>
      </form>
    </section>
  )
}
