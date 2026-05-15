import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useFormik } from 'formik'
import { z } from 'zod'
import { RotateCcw, Save } from 'lucide-react'
import { Breadcrumb } from '../../components/Breadcrumb.jsx'
import { Button } from '../../components/Button.jsx'
import { LineItemsGrid } from '../../components/LineItemsGrid.jsx'
import { AddOriginButton } from '../../components/AddOriginButton.jsx'
import {
  getIngredientsBulkByIds,
  getIngredientRunningStockByOrigin,
  getIngredientRunningStockDefault,
  listIngredients,
  listIngredientUnitConversions,
} from '../../apis/ingredient.js'
import { createTransfer, getTransferById, updateTransferById } from '../../apis/transfer.js'
import { MultiSelect } from '../../components/MultiSelect.jsx'
import { useToast } from '../../components/Toaster.jsx'
import { OriginsProvider, useOrigins } from '../../context/OriginsContext.jsx'

function newRow() {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    item_code: '',
    ingredient_id: '',
    ingredient_label: '',
    qty: '',
    unit: '',
    unitOptions: null,
    unitConversions: null,
    baseUnit: '',
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

const TransferFormSchema = z
  .object({
    transferDate: z.string().min(1, 'Please pick a transfer date.'),
    fromOriginId: z.string().refine((s) => {
      const n = Number(s)
      return Number.isFinite(n) && n > 0
    }, 'Please select a From origin.'),
    toOriginId: z.string().refine((s) => {
      const n = Number(s)
      return Number.isFinite(n) && n > 0
    }, 'Please select a To origin.'),
    notes: z.string().optional(),
    rows: z.array(z.any()),
  })
  .superRefine((data, ctx) => {
    if (Number(data.fromOriginId) === Number(data.toOriginId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'From and To origins must be different.',
        path: ['toOriginId'],
      })
    }

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
      const unit = String(r?.unit ?? '').trim()
      if (!unit) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Each line with an item needs a unit.',
          path: ['items'],
        })
        return
      }
    }

    const hasLine = data.rows.some((r) => {
      const ingId = Number(r?.ingredient_id)
      const qty = parseFloat(String(r?.qty ?? '').replace(',', '.'))
      const unit = String(r?.unit ?? '').trim()
      return Number.isFinite(ingId) && ingId > 0 && Number.isFinite(qty) && qty > 0 && unit.length > 0
    })
    if (!hasLine) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Add at least one line item with an item, qty, and unit.',
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

/**
 * @param {{ id: unknown }[]} origins
 * @param {{ id: number } | null} defaultOrigin
 */
function buildFreshTransferValues(origins, defaultOrigin) {
  const first = origins.find((o) => o?.id)?.id
  const second = origins.find((o) => o?.id && Number(o.id) !== Number(first))?.id
  const def = defaultOrigin?.id ? Number(defaultOrigin.id) : null
  const fromPick = Number.isFinite(def) && def > 0 ? def : first ? Number(first) : ''
  let toPick = ''
  if (second && Number(second) !== Number(fromPick)) toPick = String(second)
  else if (first && Number(first) !== Number(fromPick)) toPick = String(first)
  return {
    transferDate: todayLocalDate(),
    fromOriginId: fromPick ? String(fromPick) : '',
    toOriginId: toPick ? String(toPick) : '',
    notes: '',
    rows: [newRow()],
  }
}

/**
 * @param {number} editId
 */
async function loadEditBootstrap(editId) {
  const raw = await getTransferById(editId)
  const t = raw?.transfer ?? raw
  if (!t?.id) throw new Error('Transfer not found.')

  const items = Array.isArray(t.items) ? t.items : []
  const ingIds = [
    ...new Set(items.map((it) => Number(it.ingredient_id)).filter((n) => Number.isFinite(n) && n > 0)),
  ]

  const bulkRaw = ingIds.length ? await getIngredientsBulkByIds(ingIds) : {}
  const bulkItems = Array.isArray(bulkRaw?.items) ? bulkRaw.items : []

  /** @type {Record<string, { id: number, item_code?: number|null, name?: string, unit?: string }>} */
  const ingredientsById = {}
  /** @type {Record<string, { id: number, item_code?: number|null, name?: string, unit?: string }>} */
  const ingredientsByItemCode = {}
  for (const it of bulkItems) {
    const id = Number(it?.id)
    if (!Number.isFinite(id) || id <= 0) continue
    const ing = {
      id,
      item_code: it?.item_code ?? null,
      name: it?.name ?? '',
      unit: it?.unit ?? '',
    }
    ingredientsById[String(id)] = ing
    const code = ing.item_code === null || ing.item_code === undefined ? '' : String(ing.item_code)
    if (code) ingredientsByItemCode[code] = ing
  }

  /** @type {Map<number, { convItems: unknown[], unitOptions: { value: string, label: string }[] | null, baseUnit: string }>} */
  const perIngMeta = new Map()
  await Promise.all(
    ingIds.map(async (ingredientId) => {
      const ingKey = String(ingredientId)
      let convItems = []
      try {
        const convData = await listIngredientUnitConversions(ingKey)
        convItems = Array.isArray(convData?.items) ? convData.items : []
      } catch {
        // ignore
      }

      const ing = ingredientsById[ingKey]
      const baseUnit = ing?.unit ? String(ing.unit) : ''
      const units = []
      if (baseUnit) units.push(baseUnit)
      for (const c of convItems) {
        const from = c?.from_unit ? String(c.from_unit) : ''
        const to = c?.to_unit ? String(c.to_unit) : ''
        if (from) units.push(from)
        if (to) units.push(to)
      }
      const uniq = [...new Set(units)]
      const unitOptions = uniq.length ? uniq.map((u) => ({ value: u, label: u })) : null
      perIngMeta.set(ingredientId, { convItems, unitOptions, baseUnit })
    }),
  )

  function fmtQty(q) {
    const rawN = q === undefined || q === null ? NaN : Number(q)
    if (!Number.isFinite(rawN)) return String(q ?? '')
    return rawN % 1 === 0 ? String(rawN) : String(rawN)
  }

  const rows =
    items.length === 0
      ? [newRow()]
      : items.map((it) => {
          const ingredientId = Number(it.ingredient_id)
          const ingKey = String(ingredientId)
          const ing = ingredientsById[ingKey]
          const meta = perIngMeta.get(ingredientId) || {
            convItems: [],
            unitOptions: null,
            baseUnit: '',
          }
          const storedUnit =
            it.unit != null && String(it.unit).trim() !== '' ? String(it.unit).trim() : meta.baseUnit
          const row = newRow()
          return {
            ...row,
            ingredient_id: Number.isFinite(ingredientId) && ingredientId > 0 ? ingKey : '',
            item_code: ing?.item_code != null && ing?.item_code !== undefined ? String(ing.item_code) : '',
            ingredient_label:
              buildIngredientLabel(ing) || (it.ingredient_name ? String(it.ingredient_name) : ingKey),
            qty: fmtQty(it.qty),
            unit: storedUnit,
            unitOptions: meta.unitOptions,
            unitConversions: meta.convItems,
            baseUnit: meta.baseUnit,
          }
        })

  const td = t.transfer_date != null ? String(t.transfer_date).trim() : t.date != null ? String(t.date).trim() : ''
  const transferDate = td.length >= 10 ? td.slice(0, 10) : td || todayLocalDate()

  const initialValues = {
    transferDate,
    fromOriginId: String(Number(t.from_origin_id) || ''),
    toOriginId: String(Number(t.to_origin_id) || ''),
    notes: t.note != null && t.note !== undefined ? String(t.note) : '',
    rows,
  }

  return {
    initialValues,
    resetSnapshot: structuredClone(initialValues),
    ingredientsById,
    ingredientsByItemCode,
  }
}

export function TransfersTransferForm({ editTransferId } = {}) {
  const isEdit = Number.isFinite(Number(editTransferId)) && Number(editTransferId) > 0
  const editId = isEdit ? Number(editTransferId) : 0
  const [editBoot, setEditBoot] = useState(null)
  const [editLoadError, setEditLoadError] = useState('')

  useEffect(() => {
    if (!isEdit) return
    let cancelled = false
    const timer = window.setTimeout(() => {
      setEditLoadError('')
      setEditBoot(null)
      void (async () => {
        try {
          const boot = await loadEditBootstrap(editId)
          if (!cancelled) setEditBoot(boot)
        } catch (e) {
          if (!cancelled) {
            setEditLoadError(
              e?.response?.data?.error || e?.response?.data?.message || e?.message || 'Failed to load transfer.',
            )
          }
        }
      })()
    }, 0)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [isEdit, editId])

  if (isEdit && editLoadError) {
    return (
      <section className="space-y-4">
        <div className="mt-4" />
        <Breadcrumb items={[{ label: 'Transfers', href: '/transfers/history' }, { label: 'Edit' }]} />
        <p className="text-sm text-red-700">{editLoadError}</p>
      </section>
    )
  }

  if (isEdit && !editBoot) {
    return (
      <section className="space-y-4">
        <div className="mt-4" />
        <Breadcrumb items={[{ label: 'Transfers', href: '/transfers/history' }, { label: 'Edit' }]} />
        <p className="mt-2 text-sm text-slate-600">Loading…</p>
      </section>
    )
  }

  return (
    <TransfersTransferFormInner
      key={isEdit ? `edit-${editId}` : 'create'}
      mode={isEdit ? 'edit' : 'create'}
      editId={editId}
      editBoot={isEdit ? editBoot : undefined}
    />
  )
}

function TransfersTransferFormInner({ mode, editId, editBoot }) {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { origins: originOptions, defaultOrigin, addOrigin } = useOrigins()
  const valuesRef = useRef(null)
  const rowsRef = useRef(null)

  const formik = useFormik({
    initialValues:
      mode === 'edit' && editBoot?.initialValues
        ? editBoot.initialValues
        : {
            transferDate: todayLocalDate(),
            fromOriginId: '',
            toOriginId: '',
            notes: '',
            rows: [newRow()],
          },
    validateOnChange: false,
    validateOnBlur: false,
    validateOnMount: false,
    validate: (values) => {
      const res = TransferFormSchema.safeParse(values)
      if (res.success) return {}
      return zodToFormikErrors(res.error)
    },
    onSubmit: async (values, helpers) => {
      if (!confirm('Are you sure you want to save this transfer?')) return
      helpers.setStatus(undefined)
      const fromId = Number(values.fromOriginId)
      const toId = Number(values.toOriginId)

      if (mode === 'edit') {
        const items = []
        for (const r of values.rows) {
          const ingId = Number(r?.ingredient_id)
          const qty = parseFloat(String(r?.qty ?? '').replace(',', '.'))
          if (!Number.isFinite(ingId) || ingId <= 0) continue
          if (!Number.isFinite(qty) || qty <= 0) continue
          const unit = String(r?.unit ?? '').trim()
          if (!unit) continue
          items.push({ ingredient_id: ingId, qty, unit })
        }

        helpers.setSubmitting(true)
        try {
          const note = String(values.notes ?? '').trim()
          await updateTransferById(editId, {
            from_origin_id: fromId,
            to_origin_id: toId,
            transfer_date: values.transferDate,
            note: note === '' ? null : note,
            items,
          })
          showToast({ text: 'Transfer updated.', theme: 'success', duration: 4000 })
          navigate('/transfers/history')
        } catch (e) {
          const apiMsg = e?.response?.data?.error || e?.message || 'Failed to save transfer.'
          console.error('[Transfer update failed]', e)
          helpers.setStatus(String(apiMsg))
        } finally {
          helpers.setSubmitting(false)
        }
        return
      }

      const items = []
      for (const r of values.rows) {
        const ingId = Number(r?.ingredient_id)
        const qty = parseFloat(String(r?.qty ?? '').replace(',', '.'))
        if (!Number.isFinite(ingId) || ingId <= 0) continue
        if (!Number.isFinite(qty) || qty <= 0) continue
        const unit = String(r?.unit ?? '').trim()
        if (!unit) continue
        items.push({ ingredient_id: ingId, qty, unit })
      }

      const payload = {
        from_origin_id: fromId,
        to_origin_id: toId,
        transfer_date: values.transferDate,
        items,
      }
      const note = String(values.notes ?? '').trim()
      if (note) payload.note = note

      helpers.setSubmitting(true)
      try {
        const data = await createTransfer(payload)
        console.info('[Transfer created]', data)
        helpers.resetForm({ values: buildFreshTransferValues(originOptions, defaultOrigin) })
        showToast({ text: 'Transfer saved successfully.', theme: 'success', duration: 5000 })
      } catch (e) {
        const apiMsg = e?.response?.data?.error || e?.message || 'Failed to save transfer.'
        console.error('[Transfer save failed]', e)
        helpers.setStatus(String(apiMsg))
      } finally {
        helpers.setSubmitting(false)
      }
    },
  })

  valuesRef.current = formik.values
  rowsRef.current = formik.values.rows

  function setRows(updater) {
    const prev = Array.isArray(rowsRef.current) ? rowsRef.current : formik.values.rows ?? []
    const next = typeof updater === 'function' ? updater(prev) : updater
    rowsRef.current = next
    formik.setFieldValue('rows', next)
  }

  function clearFieldError(key) {
    formik.setFieldError(key, undefined)
  }

  const handleResetForm = useCallback(() => {
    if (mode === 'edit' && editBoot?.resetSnapshot) {
      formik.resetForm({ values: structuredClone(editBoot.resetSnapshot) })
    } else {
      formik.resetForm({ values: buildFreshTransferValues(originOptions, defaultOrigin) })
    }
    formik.setStatus(undefined)
  }, [mode, editBoot, originOptions, defaultOrigin, formik.resetForm, formik.setStatus])

  const [ingredientOptions, setIngredientOptions] = useState(
    () => /** @type {{ value: string, label: string }[]} */ ([]),
  )
  const [ingredientsById, setIngredientsById] = useState(
    () =>
      /** @type {Record<string, { id: number, item_code?: number|null, name?: string, unit?: string }>} */ (
        mode === 'edit' && editBoot?.ingredientsById ? { ...editBoot.ingredientsById } : {}
      ),
  )
  const [ingredientsByItemCode, setIngredientsByItemCode] = useState(
    () =>
      /** @type {Record<string, { id: number, item_code?: number|null, name?: string, unit?: string }>} */ (
        mode === 'edit' && editBoot?.ingredientsByItemCode ? { ...editBoot.ingredientsByItemCode } : {}
      ),
  )
  const [ingredientSearch, setIngredientSearch] = useState('')

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

        const prev = Array.isArray(rowsRef.current) ? rowsRef.current : formik.values.rows ?? []
        const nextRows = prev.map((r) => {
          if (String(r.id) !== rowKey) return r
          if (String(r.ingredient_id ?? '') !== ingKey) return r
          const nextUnit = baseUnit || String(r.unit ?? '')
          return { ...r, unitOptions: opts, unitConversions: convItems, unit: nextUnit }
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

      const fromStr = String(valuesRef.current?.fromOriginId ?? '').trim()
      const fromNum = fromStr ? Number(fromStr) : NaN

      try {
        let data
        if (Number.isFinite(fromNum) && fromNum > 0) {
          data = await getIngredientRunningStockByOrigin(ingKey, fromNum)
        } else {
          data = await getIngredientRunningStockDefault(ingKey)
        }
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

  useEffect(() => {
    const prev = Array.isArray(rowsRef.current) ? rowsRef.current : formik.values.rows ?? []
    for (const r of prev) {
      if (r?.ingredient_id) void loadDefaultStockIntoRow(r.id, r.ingredient_id)
    }
  }, [formik.values.fromOriginId, loadDefaultStockIntoRow])

  const handleOriginCreated = useCallback(
    (created) => {
      addOrigin(created)
      const idNum = created?.id != null ? Number(created.id) : NaN
      const isDef = Number(created?.is_default ?? 0) === 1
      if (isDef && Number.isFinite(idNum) && idNum > 0) {
        formik.setFieldValue('fromOriginId', String(idNum))
      }
    },
    [addOrigin, formik.setFieldValue],
  )

  const defaultOriginId = defaultOrigin?.id ?? null
  const firstOriginId = originOptions[0]?.id ?? null
  const originsSeedDoneRef = useRef(false)
  useEffect(() => {
    if (mode === 'edit') return
    if (originsSeedDoneRef.current) return
    const opts = originOptions
    if (!opts.length) return
    const pickFrom = defaultOriginId ?? firstOriginId
    if (pickFrom) formik.setFieldValue('fromOriginId', String(pickFrom))
    const fromNum = Number(pickFrom)
    const other = opts.find((o) => Number(o.id) !== fromNum)
    if (other) formik.setFieldValue('toOriginId', String(other.id))
    originsSeedDoneRef.current = true
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot seed when origins first load
  }, [mode, originOptions, defaultOriginId, firstOriginId])

  useEffect(() => {
    let cancelled = false
    const t = setTimeout(() => {
      void (async () => {
        try {
          const q = ingredientSearch.trim() || undefined
          const { items } = await listIngredients({
            q,
            limit: 20,
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

          setIngredientsById((prev) => ({ ...prev, ...byIdDelta }))
          setIngredientsByItemCode((prev) => ({ ...prev, ...byCodeDelta }))
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

  const currentStockHeaderOrigin = useMemo(() => {
    const fromStr = String(formik.values.fromOriginId ?? '').trim()
    const fromNum = fromStr ? Number(fromStr) : NaN
    if (Number.isFinite(fromNum) && fromNum > 0) {
      const o = originOptions.find((x) => Number(x.id) === fromNum)
      const name = o?.name != null ? String(o.name).trim() : ''
      return name || `Origin #${fromNum}`
    }
    const def = defaultOrigin
    const defName = def?.name != null ? String(def.name).trim() : ''
    return defName || 'Default origin'
  }, [formik.values.fromOriginId, originOptions, defaultOrigin])

  const transferColumns = useMemo(
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
              value={value}
              onChange={(e) => {
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
                  updateCell('unitConversions', null)
                  updateCell('baseUnit', baseUnit)
                  const hasQty = String(row?.qty ?? '').trim() !== ''
                  if (!hasQty) updateCell('qty', '1')
                  void loadConversionsIntoRow(row.id, ing.id)
                  void loadDefaultStockIntoRow(row.id, ing.id)
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

                  const hasQty = String(row?.qty ?? '').trim() !== ''
                  if (ing?.id && !hasQty) updateCell('qty', '1')

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
              value={val}
              onChange={(e) => updateCell('unit', e.target.value)}
              placeholder="Unit"
              className="box-border h-9 w-full border-0 bg-transparent px-2 py-1 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:bg-slate-50 focus:ring-2 focus:ring-inset focus:ring-slate-300"
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
                <span className="ms-1 font-normal text-slate-900">
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
      currentStockHeaderOrigin,
      ingredientOptions,
      ingredientsById,
      ingredientsByItemCode,
      loadConversionsIntoRow,
      loadDefaultStockIntoRow,
    ],
  )

  return (
    <section className="space-y-4">
      <div className="mt-4" />
      <Breadcrumb
        items={
          mode === 'edit'
            ? [{ label: 'Transfers', href: '/transfers/history' }, { label: 'Edit' }]
            : [{ label: 'Transfers', href: '/transfers/history' }, { label: 'Create' }]
        }
      />

      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-slate-900">
          {mode === 'edit' ? `Edit transfer #${editId}` : 'Create transfer'}
        </h2>
        <AddOriginButton onCreated={handleOriginCreated} />
      </div>

      <form onSubmit={formik.handleSubmit} className="space-y-4" data-transfer-form="">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-900 ms-1">Transfer date</span>
            <input
              type="date"
              name="transferDate"
              value={formik.values.transferDate}
              onChange={(e) => {
                formik.handleChange(e)
                clearFieldError('transferDate')
              }}
              onBlur={formik.handleBlur}
              aria-invalid={Boolean(formik.errors.transferDate)}
              className={
                'h-10 w-full rounded-lg border bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 ' +
                (formik.errors.transferDate
                  ? 'border-red-400 focus:ring-red-300'
                  : 'border-slate-200 focus:ring-slate-300')
              }
            />
            {formik.errors.transferDate ? (
              <p className="text-xs text-red-600" role="alert">
                {formik.errors.transferDate}
              </p>
            ) : null}
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-900 ms-1">From origin</span>
            <select
              name="fromOriginId"
              value={formik.values.fromOriginId}
              onChange={(e) => {
                formik.handleChange(e)
                clearFieldError('fromOriginId')
                clearFieldError('toOriginId')
              }}
              onBlur={formik.handleBlur}
              aria-invalid={Boolean(formik.errors.fromOriginId)}
              className={
                'h-10 w-full rounded-lg border bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 ' +
                (formik.errors.fromOriginId
                  ? 'border-red-400 focus:ring-red-300'
                  : 'border-slate-200 focus:ring-slate-300')
              }
            >
              {originOptions.length === 0 ? (
                <option value="">No origins found</option>
              ) : (
                <>
                  <option value="">Select origin…</option>
                  {originOptions.map((o) => (
                    <option key={o.id} value={String(o.id)}>
                      {o.name}
                    </option>
                  ))}
                </>
              )}
            </select>
            {formik.errors.fromOriginId ? (
              <p className="text-xs text-red-600" role="alert">
                {formik.errors.fromOriginId}
              </p>
            ) : null}
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-900 ms-1">To origin</span>
            <select
              name="toOriginId"
              value={formik.values.toOriginId}
              onChange={(e) => {
                formik.handleChange(e)
                clearFieldError('toOriginId')
                clearFieldError('fromOriginId')
              }}
              onBlur={formik.handleBlur}
              aria-invalid={Boolean(formik.errors.toOriginId)}
              className={
                'h-10 w-full rounded-lg border bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 ' +
                (formik.errors.toOriginId
                  ? 'border-red-400 focus:ring-red-300'
                  : 'border-slate-200 focus:ring-slate-300')
              }
            >
              {originOptions.length === 0 ? (
                <option value="">No origins found</option>
              ) : (
                <>
                  <option value="">Select origin…</option>
                  {originOptions.map((o) => (
                    <option key={o.id} value={String(o.id)}>
                      {o.name}
                    </option>
                  ))}
                </>
              )}
            </select>
            {formik.errors.toOriginId ? (
              <p className="text-xs text-red-600" role="alert">
                {formik.errors.toOriginId}
              </p>
            ) : null}
          </label>
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
            columns={transferColumns}
            showRowActions
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
            <Button type="button" variant="secondary" disabled={formik.isSubmitting} onClick={handleResetForm}>
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

export function TransfersCreatePage() {
  return (
    <OriginsProvider>
      <TransfersTransferForm />
    </OriginsProvider>
  )
}
