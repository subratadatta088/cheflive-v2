const express = require('express')
const { requireAuth } = require('../../middleware/auth')
const { withScopedModels } = require('../../middleware/rbacModels')
const { z } = require('zod')
const {
  UnitConversionCreateSchema,
  UnitConversionIdSchema,
  UnitConversionListQuerySchema,
  UnitConversionUpdateSchema,
} = require('../../models/unitConversion/schema')
const { IngredientIdSchema } = require('../../models/ingredient/schema')

const router = express.Router()

router.use(requireAuth, withScopedModels)

function isSuperAdmin(req) {
  return Array.isArray(req.user?.roles) && req.user.roles.includes('superadmin')
}

router.post('/', async (req, res) => {
  const body = { ...req.body }

  if (isSuperAdmin(req)) {
    if (!body.organization_id)
      return res.status(400).json({ error: 'organization_id is required' })
  } else {
    body.organization_id = req.user.organization_id
  }

  const parsed = UnitConversionCreateSchema.safeParse(body)
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' })

  try {
    const created = await req.models.unitConversion.create(parsed.data)
    return res.json({ unit_conversion: created })
  } catch (e) {
    const msg = String(e?.message || '')
    if (msg.includes('Ingredient organization mismatch')) {
      return res.status(400).json({ error: 'Ingredient organization mismatch' })
    }
    if (msg.includes('Ingredient not found')) {
      return res.status(400).json({ error: 'Ingredient not found' })
    }
    throw e
  }
})

/**
 * Bulk create unit conversions.
 * POST /unit-conversions/bulk
 * Body: { items: UnitConversionCreate[] } | UnitConversionCreate[]
 */
router.post('/bulk', async (req, res) => {
  const raw = req.body
  const items = Array.isArray(raw) ? raw : Array.isArray(raw?.items) ? raw.items : null
  if (!items) return res.status(400).json({ error: 'items array is required' })

  const inputs = items.map((it) => {
    const body = { ...it }
    if (!isSuperAdmin(req)) body.organization_id = req.user.organization_id
    return body
  })

  const valid = []
  const failures = []
  for (let i = 0; i < inputs.length; i++) {
    const parsed = UnitConversionCreateSchema.safeParse(inputs[i])
    if (!parsed.success) {
      failures.push({ row: i + 1, ingredient_id: Number(inputs[i]?.ingredient_id) || null, error: 'Invalid payload' })
      continue
    }
    valid.push({ row: i + 1, data: parsed.data })
  }

  const bulkResult = await req.models.unitConversion.bulkCreate(valid.map((v) => v.data))
  const mergedFailures = [
    ...failures,
    ...(bulkResult.failures || []).map((f) => ({
      row: f.row ?? null,
      ingredient_id: f.ingredient_id ?? null,
      error: f.error ?? 'Failed',
    })),
  ]

  return res.json({
    total: inputs.length,
    created: bulkResult.created || 0,
    failed: mergedFailures.length,
    failures: mergedFailures,
  })
})

router.get('/', async (req, res) => {
  const parsed = UnitConversionListQuerySchema.safeParse(req.query)
  if (!parsed.success) return res.status(400).json({ error: 'Invalid query' })

  const query = { ...parsed.data }

  if (isSuperAdmin(req)) {
    if (!query.organization_id)
      return res.status(400).json({ error: 'organization_id is required' })
  } else {
    query.organization_id = req.user.organization_id
  }

  const items = await req.models.unitConversion.list(query)
  return res.json({
    page: query.page,
    limit: query.limit,
    items,
  })
})

/**
 * Conversions for one ingredient. Must be registered before `/:id` so "ingredient" is not parsed as an id.
 * RBAC: admin/member only see ingredients in their org (ingredient.getById). Superadmin can resolve any ingredient.
 */
router.get('/ingredient/:ingredient_id', async (req, res) => {
  const idParsed = IngredientIdSchema.safeParse(Number(req.params.ingredient_id))
  if (!idParsed.success) return res.status(400).json({ error: 'Invalid ingredient_id' })

  const ingredient = await req.models.ingredient.getById(idParsed.data)
  if (!ingredient) return res.status(404).json({ error: 'Not found' })

  const queryParsed = UnitConversionListQuerySchema.pick({
    page: true,
    limit: true,
  }).safeParse(req.query)

  const page = queryParsed.success ? queryParsed.data.page : 1
  const limit = queryParsed.success ? queryParsed.data.limit : 100

  const items = await req.models.unitConversion.list({
    organization_id: ingredient.organization_id,
    ingredient_id: idParsed.data,
    page,
    limit,
  })

  return res.json({
    ingredient_id: idParsed.data,
    page,
    limit,
    items,
  })
})

router.get('/:id', async (req, res) => {
  const idParsed = UnitConversionIdSchema.safeParse(Number(req.params.id))
  if (!idParsed.success) return res.status(400).json({ error: 'Invalid id' })

  const item = await req.models.unitConversion.getById(idParsed.data)
  if (!item) return res.status(404).json({ error: 'Not found' })
  return res.json({ unit_conversion: item })
})

router.patch('/:id', async (req, res) => {
  const idParsed = UnitConversionIdSchema.safeParse(Number(req.params.id))
  if (!idParsed.success) return res.status(400).json({ error: 'Invalid id' })

  const bodyParsed = UnitConversionUpdateSchema.safeParse(req.body)
  if (!bodyParsed.success) return res.status(400).json({ error: 'Invalid payload' })

  const updated = await req.models.unitConversion.updateById(idParsed.data, bodyParsed.data)
  if (!updated) return res.status(404).json({ error: 'Not found' })
  return res.json({ unit_conversion: updated })
})

/**
 * Bulk update unit conversions.
 * PUT /unit-conversions/bulk
 * Body: { items: UnitConversionBulkUpdate[] } | UnitConversionBulkUpdate[]
 */
router.put('/bulk', async (req, res) => {
  const raw = req.body
  const items = Array.isArray(raw) ? raw : Array.isArray(raw?.items) ? raw.items : null
  if (!items) return res.status(400).json({ error: 'items array is required' })

  const BulkUpdateRowSchema = z
    .object({ id: z.coerce.number().int().positive() })
    .merge(UnitConversionUpdateSchema)

  const failures = []
  const valid = []

  for (let i = 0; i < items.length; i++) {
    const input = items[i] || {}
    const parsed = BulkUpdateRowSchema.safeParse(input)
    if (!parsed.success) {
      failures.push({ row: i + 1, id: Number(input?.id) || null, error: 'Invalid payload' })
      continue
    }

    const data = { ...parsed.data }
    const id = data.id
    delete data.id

    if (!Object.keys(data).length) {
      failures.push({ row: i + 1, id, error: 'No fields to update' })
      continue
    }

    valid.push({ row: i + 1, id, data })
  }

  const bulkResult = await req.models.unitConversion.bulkUpdate(valid.map((v) => ({ id: v.id, data: v.data })))
  const mergedFailures = [
    ...failures,
    ...(bulkResult.failures || []).map((f) => ({
      row: f.row ?? null,
      id: f.id ?? null,
      error: f.error ?? 'Failed',
    })),
  ]

  return res.json({
    total: items.length,
    updated: bulkResult.updated || 0,
    failed: mergedFailures.length,
    failures: mergedFailures,
  })
})

router.delete('/:id', async (req, res) => {
  const idParsed = UnitConversionIdSchema.safeParse(Number(req.params.id))
  if (!idParsed.success) return res.status(400).json({ error: 'Invalid id' })

  const ok = await req.models.unitConversion.deleteById(idParsed.data)
  return res.json({ ok: Boolean(ok) })
})

module.exports = { unitConversionsRouter: router }
