const express = require('express')
const { z } = require('zod')
const { parse } = require('csv-parse/sync')
const { requireAuth } = require('../../middleware/auth')
const { withScopedModels } = require('../../middleware/rbacModels')
const {
  IngredientCreateSchema,
  IngredientIdSchema,
  IngredientListQuerySchema,
  IngredientUpdateSchema,
} = require('../../models/ingredient/schema')

const router = express.Router()

router.use(requireAuth, withScopedModels)

router.post('/bulk-upload', async (req, res) => {
  const file = req.files?.file
  if (!file) return res.status(400).json({ error: 'file is required' })

  const csvText =
    Buffer.isBuffer(file.data) ? file.data.toString('utf8') : String(file.data || '')

  let records = []
  try {
    records = parse(csvText, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    })
  } catch {
    return res.status(400).json({ error: 'Invalid CSV' })
  }

  const results = []
  let createdCount = 0
  let failedCount = 0

  for (let i = 0; i < records.length; i++) {
    const r = records[i] || {}

    const mapped = {
      organization_id: req.user.organization_id,
      name: r.name,
      unit: r.unit,
      base_price: r.base_price !== undefined && r.base_price !== '' ? Number(r.base_price) : undefined,
      tags:
        r.tags !== undefined && r.tags !== ''
          ? String(r.tags)
              .split('|')
              .map((s) => s.trim())
              .filter(Boolean)
          : undefined,
      is_active:
        r.is_active !== undefined && r.is_active !== ''
          ? String(r.is_active).toLowerCase() === 'true' || String(r.is_active) === '1'
          : undefined,
    }

    const parsed = IngredientCreateSchema.safeParse(mapped)
    if (!parsed.success) {
      failedCount++
      results.push({ row: i + 1, ok: false, error: 'Invalid payload' })
      continue
    }

    try {
      const created = await req.models.ingredient.create(parsed.data)
      createdCount++
      results.push({ row: i + 1, ok: true, ingredient: created })
    } catch (e) {
      failedCount++
      results.push({ row: i + 1, ok: false, error: String(e?.message || 'Failed') })
    }
  }

  return res.json({
    total: records.length,
    created: createdCount,
    failed: failedCount,
    results,
  })
})

router.post('/', async (req, res) => {
  const parsed = IngredientCreateSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' })

  const created = await req.models.ingredient.create(parsed.data)
  return res.json({ ingredient: created })
})

router.get('/', async (req, res) => {
  const parsed = IngredientListQuerySchema.safeParse(req.query)
  if (!parsed.success) return res.status(400).json({ error: 'Invalid query' })

  const items = await req.models.ingredient.list(parsed.data)
  return res.json({
    page: parsed.data.page,
    limit: parsed.data.limit,
    items,
  })
})

router.get('/:id', async (req, res) => {
  const idParsed = IngredientIdSchema.safeParse(Number(req.params.id))
  if (!idParsed.success) return res.status(400).json({ error: 'Invalid id' })

  const item = await req.models.ingredient.getById(idParsed.data)
  if (!item) return res.status(404).json({ error: 'Not found' })
  return res.json({ ingredient: item })
})

router.patch('/:id', async (req, res) => {
  const idParsed = IngredientIdSchema.safeParse(Number(req.params.id))
  if (!idParsed.success) return res.status(400).json({ error: 'Invalid id' })

  const bodyParsed = IngredientUpdateSchema.safeParse(req.body)
  if (!bodyParsed.success) return res.status(400).json({ error: 'Invalid payload' })

  const updated = await req.models.ingredient.updateById(idParsed.data, bodyParsed.data)
  if (!updated) return res.status(404).json({ error: 'Not found' })
  return res.json({ ingredient: updated })
})

router.delete('/:id', async (req, res) => {
  const idParsed = IngredientIdSchema.safeParse(Number(req.params.id))
  if (!idParsed.success) return res.status(400).json({ error: 'Invalid id' })

  const ok = await req.models.ingredient.deleteById(idParsed.data)
  return res.json({ ok: Boolean(ok) })
})

module.exports = { ingredientsRouter: router }

