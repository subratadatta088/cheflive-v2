const express = require('express')
const { requireAuth } = require('../../middleware/auth')
const { withScopedModels } = require('../../middleware/rbacModels')
const { ingredientsController } = require('../../controllers/ingredientsController')
const { z } = require('zod')
const { IngredientIdSchema } = require('../../models/ingredient/schema')
const { UnitConversionCreateSchema, UnitConversionUpdateSchema } = require('../../models/unitConversion/schema')

const router = express.Router()

router.use(requireAuth, withScopedModels)

router.post('/bulk-upload', ingredientsController.bulkUploadIngredients)
router.post('/bulk', ingredientsController.bulkCreateIngredients)
router.put('/bulk', ingredientsController.bulkUpdateIngredients)
router.get('/by-item-code/:item_code', ingredientsController.getIngredientByItemCode)

/**
 * Unit conversions for an ingredient.
 * Always scoped to the ingredient's org (via ingredient.getById + RBAC).
 */
router.get('/:id/unit-conversions', async (req, res) => {
  const idParsed = IngredientIdSchema.safeParse(Number(req.params.id))
  if (!idParsed.success) return res.status(400).json({ error: 'Invalid ingredient id' })

  const ingredient = await req.models.ingredient.getById(idParsed.data)
  if (!ingredient) return res.status(404).json({ error: 'Not found' })

  const items = await req.models.unitConversion.list({
    organization_id: ingredient.organization_id,
    ingredient_id: idParsed.data,
    page: 1,
    limit: 1000,
  })

  return res.json({ ingredient_id: idParsed.data, items })
})

router.post('/:id/unit-conversions', async (req, res) => {
  const idParsed = IngredientIdSchema.safeParse(Number(req.params.id))
  if (!idParsed.success) return res.status(400).json({ error: 'Invalid ingredient id' })

  const ingredient = await req.models.ingredient.getById(idParsed.data)
  if (!ingredient) return res.status(404).json({ error: 'Not found' })

  const raw = req.body
  const items = Array.isArray(raw) ? raw : Array.isArray(raw?.items) ? raw.items : null
  if (!items) return res.status(400).json({ error: 'items array is required' })

  const normalized = items.map((it) => ({
    ...it,
    organization_id: ingredient.organization_id,
    ingredient_id: idParsed.data,
  }))

  const valid = []
  const failures = []
  for (let i = 0; i < normalized.length; i++) {
    const parsed = UnitConversionCreateSchema.safeParse(normalized[i])
    if (!parsed.success) {
      failures.push({ row: i + 1, error: 'Invalid payload' })
      continue
    }
    valid.push({ row: i + 1, data: parsed.data })
  }

  const bulkResult = await req.models.unitConversion.bulkCreate(valid.map((v) => v.data))
  const mergedFailures = [
    ...failures,
    ...(bulkResult.failures || []).map((f) => ({ row: f.row ?? null, error: f.error ?? 'Failed' })),
  ]

  return res.json({
    total: normalized.length,
    created: bulkResult.created || 0,
    failed: mergedFailures.length,
    failures: mergedFailures,
  })
})

router.put('/:id/unit-conversions', async (req, res) => {
  const idParsed = IngredientIdSchema.safeParse(Number(req.params.id))
  if (!idParsed.success) return res.status(400).json({ error: 'Invalid ingredient id' })

  const ingredient = await req.models.ingredient.getById(idParsed.data)
  if (!ingredient) return res.status(404).json({ error: 'Not found' })

  const raw = req.body
  const items = Array.isArray(raw) ? raw : Array.isArray(raw?.items) ? raw.items : null
  if (!items) return res.status(400).json({ error: 'items array is required' })

  // Upsert semantics:
  // - rows with `id` => update that conversion
  // - rows without `id` => create a new conversion for this ingredient
  const UpdateRowSchema = z.object({ id: z.coerce.number().int().positive() }).merge(UnitConversionUpdateSchema)
  const CreateRowSchema = UnitConversionCreateSchema.omit({ organization_id: true, ingredient_id: true })

  const failures = []
  const toUpdate = []
  const toCreate = []

  for (let i = 0; i < items.length; i++) {
    const input = items[i] || {}
    const hasId = input?.id !== undefined && input?.id !== null && String(input.id) !== ''

    if (hasId) {
      const parsed = UpdateRowSchema.safeParse(input)
      if (!parsed.success) {
        failures.push({ row: i + 1, id: Number(input?.id) || null, error: 'Invalid payload' })
        continue
      }
      const data = { ...parsed.data }
      const convId = data.id
      delete data.id

      if (!Object.keys(data).length) {
        failures.push({ row: i + 1, id: convId, error: 'No fields to update' })
        continue
      }

      const existing = await req.models.unitConversion.getById(convId)
      if (!existing) {
        failures.push({ row: i + 1, id: convId, error: 'Not found' })
        continue
      }
      if (Number(existing.ingredient_id) !== idParsed.data) {
        failures.push({ row: i + 1, id: convId, error: 'Conversion ingredient mismatch' })
        continue
      }

      toUpdate.push({ row: i + 1, id: convId, data })
      continue
    }

    const parsedCreate = CreateRowSchema.safeParse(input)
    if (!parsedCreate.success) {
      failures.push({ row: i + 1, id: null, error: 'Invalid payload' })
      continue
    }

    toCreate.push({
      row: i + 1,
      data: {
        ...parsedCreate.data,
        organization_id: ingredient.organization_id,
        ingredient_id: idParsed.data,
      },
    })
  }

  const createResult = toCreate.length
    ? await req.models.unitConversion.bulkCreate(toCreate.map((v) => v.data))
    : { created: 0, failures: [] }

  const updateResult = toUpdate.length
    ? await req.models.unitConversion.bulkUpdate(toUpdate.map((v) => ({ id: v.id, data: v.data })))
    : { updated: 0, failures: [] }

  const mergedFailures = [
    ...failures,
    ...(createResult.failures || []).map((f) => ({ row: f.row ?? null, id: null, error: f.error ?? 'Failed' })),
    ...(updateResult.failures || []).map((f) => ({ row: f.row ?? null, id: f.id ?? null, error: f.error ?? 'Failed' })),
  ]

  return res.json({
    total: items.length,
    created: createResult.created || 0,
    updated: updateResult.updated || 0,
    failed: mergedFailures.length,
    failures: mergedFailures,
  })
})

router.post('/', ingredientsController.createIngredient)
router.get('/', ingredientsController.listIngredients)
router.get('/:id', ingredientsController.getIngredientById)
router.patch('/:id', ingredientsController.updateIngredientById)
router.delete('/:id', ingredientsController.deleteIngredientById)

module.exports = { ingredientsRouter: router }

