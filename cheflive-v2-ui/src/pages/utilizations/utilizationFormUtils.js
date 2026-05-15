import { z } from 'zod'
import { getIngredientsBulkByIds, listIngredientUnitConversions } from '../../apis/ingredient.js'
import { getPreparationById } from '../../apis/preparation.js'

export function newRow() {
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

export function todayLocalDate() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function zodToFormikErrors(zodError) {
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

export function buildIngredientLabel(ing) {
  if (!ing) return ''
  const name = ing?.name ? String(ing.name) : 'Unnamed'
  const code = ing?.item_code === null || ing?.item_code === undefined ? '' : String(ing.item_code)
  return code ? `${name} (${code})` : name
}

/** @param {unknown} qty @param {unknown} unit */
export function parseDefaultStockParts(qty, unit) {
  const u = unit === undefined || unit === null ? '' : String(unit).trim()
  const raw = qty === undefined || qty === null ? NaN : Number(qty)
  if (!Number.isFinite(raw)) return null
  const qStr = raw % 1 === 0 ? String(raw) : String(raw)
  return { qtyStr: qStr, unitStr: u }
}

function fmtQty(q) {
  const raw = q === undefined || q === null ? NaN : Number(q)
  if (!Number.isFinite(raw)) return ''
  return raw % 1 === 0 ? String(raw) : String(raw)
}

/**
 * @param {Array<{ ingredient_id?: unknown, qty?: unknown, unit?: unknown, ingredient_name?: unknown, ingredient_item_code?: unknown }>} prepItems
 */
export async function mapPreparationItemsToRows(prepItems) {
  const items = Array.isArray(prepItems) ? prepItems : []
  if (!items.length) return []

  const ingIds = [
    ...new Set(items.map((it) => Number(it.ingredient_id)).filter((n) => Number.isFinite(n) && n > 0)),
  ]

  const bulkRaw = ingIds.length ? await getIngredientsBulkByIds(ingIds) : {}
  const bulkItems = Array.isArray(bulkRaw?.items) ? bulkRaw.items : []
  const ingredientsById = {}
  for (const it of bulkItems) {
    const id = Number(it?.id)
    if (!Number.isFinite(id) || id <= 0) continue
    ingredientsById[String(id)] = {
      id,
      item_code: it?.item_code ?? null,
      name: it?.name ?? '',
      unit: it?.unit ?? '',
    }
  }

  const rows = []
  for (const it of items) {
    const ingredientId = Number(it.ingredient_id)
    if (!Number.isFinite(ingredientId) || ingredientId <= 0) continue
    const ingKey = String(ingredientId)
    const ing = ingredientsById[ingKey]
    let unitOptions = null
    let baseUnit = ing?.unit ? String(ing.unit) : ''
    try {
      const convData = await listIngredientUnitConversions(ingKey)
      const convItems = Array.isArray(convData?.items) ? convData.items : []
      const units = []
      if (baseUnit) units.push(baseUnit)
      for (const c of convItems) {
        const from = c?.from_unit ? String(c.from_unit) : ''
        const to = c?.to_unit ? String(c.to_unit) : ''
        if (from) units.push(from)
        if (to) units.push(to)
      }
      const uniq = [...new Set(units)]
      unitOptions = uniq.length ? uniq.map((u) => ({ value: u, label: u })) : null
    } catch {
      // ignore
    }

    const storedUnit =
      it.unit != null && String(it.unit).trim() !== ''
        ? String(it.unit).trim()
        : baseUnit
    const label =
      buildIngredientLabel(ing) ||
      (it.ingredient_name ? String(it.ingredient_name) : '') ||
      ingKey
    const code =
      ing?.item_code != null
        ? String(ing.item_code)
        : it.ingredient_item_code != null
          ? String(it.ingredient_item_code)
          : ''

    rows.push({
      ...newRow(),
      ingredient_id: ingKey,
      item_code: code,
      ingredient_label: label,
      qty: fmtQty(it.qty),
      unit: storedUnit,
      unitOptions,
      baseUnit,
    })
  }

  return rows.length ? rows : [newRow()]
}

/** @param {number|string} preparationId */
export async function loadPreparationForRecord(preparationId) {
  const pid = Number(preparationId)
  if (!Number.isFinite(pid) || pid <= 0) {
    return { manualMode: false, rows: [newRow()], preparationLabel: '' }
  }

  const raw = await getPreparationById(pid)
  const prep = raw?.preparation ?? raw
  const prepItems = Array.isArray(prep?.items) ? prep.items : []
  const preparationLabel = prep?.name != null ? String(prep.name) : ''

  if (!prepItems.length) {
    return {
      manualMode: true,
      rows: [newRow()],
      preparationLabel,
      headerQty: prep?.qty != null ? fmtQty(prep.qty) : '',
      headerUnit: prep?.unit != null ? String(prep.unit) : '',
    }
  }

  const rows = await mapPreparationItemsToRows(prepItems)
  return {
    manualMode: false,
    rows,
    preparationLabel,
    headerQty: prep?.qty != null ? fmtQty(prep.qty) : '',
    headerUnit: prep?.unit != null ? String(prep.unit) : '',
  }
}

export function newUtilizationRecord(defaultOriginId) {
  const def = defaultOriginId != null && Number(defaultOriginId) > 0 ? String(defaultOriginId) : ''
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    preparationId: '',
    preparationLabel: '',
    manualMode: false,
    headerQty: '',
    headerUnit: '',
    originId: def,
    utilizationDate: todayLocalDate(),
    notes: '',
    rows: [newRow()],
  }
}

export const UtilizationRecordSchema = z
  .object({
    preparationId: z.string().refine((s) => {
      const n = Number(s)
      return Number.isFinite(n) && n > 0
    }, 'Please select a preparation.'),
    manualMode: z.boolean(),
    headerQty: z.string().optional(),
    headerUnit: z.string().optional(),
    originId: z.string().refine((s) => {
      const n = Number(s)
      return Number.isFinite(n) && n > 0
    }, 'Please select an origin.'),
    utilizationDate: z.string().min(1, 'Please pick a date.'),
    notes: z.string().optional(),
    rows: z.array(z.any()),
  })
  .superRefine((data, ctx) => {
    const headerQty = parseFloat(String(data.headerQty ?? '').replace(',', '.'))
    const headerUnit = String(data.headerUnit ?? '').trim()
    if (!Number.isFinite(headerQty) || headerQty <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Enter a positive utilization qty.',
        path: ['headerQty'],
      })
    }
    if (!headerUnit) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Enter a utilization unit.',
        path: ['headerUnit'],
      })
    }

    if (data.manualMode) return

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

/** @param {Array<{ ingredient_id?: unknown, qty?: unknown, unit?: unknown }>} rows */
export function rowsToItems(rows) {
  const items = []
  for (const r of rows) {
    const ingId = Number(r?.ingredient_id)
    const qty = parseFloat(String(r?.qty ?? '').replace(',', '.'))
    if (!Number.isFinite(ingId) || ingId <= 0) continue
    if (!Number.isFinite(qty) || qty <= 0) continue
    const unit = String(r?.unit ?? '').trim()
    if (!unit) continue
    items.push({ ingredient_id: ingId, qty, unit })
  }
  return items
}

/** @param {ReturnType<typeof newUtilizationRecord>} record */
export function recordToCreatePayload(record) {
  const origin_id = Number(record.originId)
  const preparation_id = Number(record.preparationId)
  const note = String(record.notes ?? '').trim()

  const payload = {
    origin_id,
    date: record.utilizationDate,
    preparation_id,
    type: 'preparation',
  }

  if (note) payload.note = note

  payload.qty = parseFloat(String(record.headerQty ?? '').replace(',', '.'))
  payload.unit = String(record.headerUnit ?? '').trim()

  const items = rowsToItems(record.rows)
  if (record.manualMode) {
    if (items.length) payload.items = items
  } else {
    payload.items = items
  }

  return payload
}
