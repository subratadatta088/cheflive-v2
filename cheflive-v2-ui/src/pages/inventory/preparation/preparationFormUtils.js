import { buildIngredientLabel } from '../../utilizations/utilizationFormUtils.js'

export const PREPARATION_TYPES = ['Sauce', 'Marinade', 'Dough', 'Stock', 'Dressing', 'Other']

export function newPreparationIngredientRow() {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    ingredient_id: '',
    ingredient_label: '',
    qty: '',
    unit: '',
    unitOptions: null,
    baseUnit: '',
  }
}

export function emptyPreparationFormState() {
  return {
    name: '',
    type: 'Sauce',
    unit: 'kg',
    tags: '',
    is_active: true,
    rows: [newPreparationIngredientRow()],
  }
}

/** @param {string} raw */
export function parseTagsInput(raw) {
  const t = String(raw ?? '').trim()
  if (!t) return []
  return t
    .split(/[|,]/)
    .map((s) => s.trim())
    .filter(Boolean)
}

/** @param {unknown} tags */
export function formatTagsForInput(tags) {
  if (Array.isArray(tags)) return tags.map((t) => String(t).trim()).filter(Boolean).join('|')
  if (typeof tags === 'string' && tags.trim()) {
    try {
      const parsed = JSON.parse(tags)
      if (Array.isArray(parsed)) return parsed.map((t) => String(t).trim()).filter(Boolean).join('|')
    } catch {
      return tags.trim()
    }
  }
  return ''
}

function fmtQty(q) {
  const raw = q === undefined || q === null ? NaN : Number(q)
  if (!Number.isFinite(raw)) return ''
  return raw % 1 === 0 ? String(raw) : String(raw)
}

/**
 * @param {unknown} prep API preparation with items
 */
export function preparationToFormState(prep) {
  const base = emptyPreparationFormState()
  if (!prep || typeof prep !== 'object') return base

  const items = Array.isArray(prep.items) ? prep.items : []
  const rows =
    items.length > 0
      ? items.map((it) => {
          const ingredientId =
            it.ingredient_id != null && Number(it.ingredient_id) > 0 ? String(it.ingredient_id) : ''
          const label =
            it.ingredient_name != null && String(it.ingredient_name).trim() !== ''
              ? buildIngredientLabel({
                  id: it.ingredient_id,
                  name: it.ingredient_name,
                  item_code: it.ingredient_item_code ?? null,
                })
              : ingredientId
                ? `#${ingredientId}`
                : ''
          const unit =
            it.unit != null && String(it.unit).trim() !== '' ? String(it.unit).trim() : ''
          return {
            ...newPreparationIngredientRow(),
            ingredient_id: ingredientId,
            ingredient_label: label,
            qty: fmtQty(it.qty),
            unit,
            unitOptions: unit ? [{ value: unit, label: unit }] : null,
            baseUnit: unit,
          }
        })
      : [newPreparationIngredientRow()]

  return {
    name: prep.name != null ? String(prep.name) : '',
    type: prep.type != null && String(prep.type).trim() !== '' ? String(prep.type) : 'Other',
    unit: prep.unit != null && String(prep.unit).trim() !== '' ? String(prep.unit) : 'kg',
    tags: formatTagsForInput(prep.tags),
    is_active: Number(prep.is_active ?? 1) === 1,
    rows,
  }
}

/**
 * @param {Array<{ ingredient_id?: string, qty?: string, unit?: string }>} rows
 */
export function rowsToApiItems(rows) {
  const out = []
  for (const row of Array.isArray(rows) ? rows : []) {
    const ingredient_id = Number(row?.ingredient_id)
    if (!Number.isFinite(ingredient_id) || ingredient_id <= 0) continue
    const qtyRaw = String(row?.qty ?? '').trim()
    const qty = qtyRaw === '' ? undefined : Number(qtyRaw)
    if (qtyRaw !== '' && !Number.isFinite(qty)) continue
    const unit = String(row?.unit ?? '').trim()
    out.push({
      ingredient_id,
      ...(qty !== undefined ? { qty } : {}),
      ...(unit ? { unit } : {}),
    })
  }
  return out
}

/**
 * @param {{ name: string, type: string, unit: string, tags: string, is_active: boolean, rows: unknown[] }} form
 */
export function buildPreparationWritePayload(form) {
  const name = String(form?.name ?? '').trim()
  const type = String(form?.type ?? '').trim()
  const unit = String(form?.unit ?? '').trim()
  const tags = parseTagsInput(form?.tags)
  const items = rowsToApiItems(form?.rows)

  return {
    preparation: {
      name,
      ...(type ? { type } : {}),
      ...(unit ? { unit } : {}),
      ...(tags.length ? { tags } : {}),
      is_active: Boolean(form?.is_active),
    },
    items,
  }
}

/** @param {{ name: string, rows: unknown[] }} form */
export function validatePreparationForm(form) {
  /** @type {Record<string, string>} */
  const errors = {}
  if (!String(form?.name ?? '').trim()) errors.name = 'Name is required.'
  const items = rowsToApiItems(form?.rows)
  if (!items.length) errors.items = 'Add at least one ingredient line.'
  return errors
}
