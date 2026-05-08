const { parse } = require('csv-parse/sync')
const { z } = require('zod')

const {
  IngredientCreateSchema,
  IngredientIdSchema,
  IngredientListQuerySchema,
  IngredientUpdateSchema,
} = require('../models/ingredient/schema')

class IngredientsController {
  constructor() {
    this.bulkUploadIngredients = this.bulkUploadIngredients.bind(this)
    this.bulkCreateIngredients = this.bulkCreateIngredients.bind(this)
    this.bulkUpdateIngredients = this.bulkUpdateIngredients.bind(this)
    this.getIngredientByItemCode = this.getIngredientByItemCode.bind(this)
    this.createIngredient = this.createIngredient.bind(this)
    this.listIngredients = this.listIngredients.bind(this)
    this.getIngredientById = this.getIngredientById.bind(this)
    this.getIngredientRunningStock = this.getIngredientRunningStock.bind(this)
    this.getIngredientRunningStockByOrigin = this.getIngredientRunningStockByOrigin.bind(this)
    this.listIngredientStockTransitions = this.listIngredientStockTransitions.bind(this)
    this.updateIngredientById = this.updateIngredientById.bind(this)
    this.deleteIngredientById = this.deleteIngredientById.bind(this)
  }

  async _assertCategory(req, res, { organization_id, category_id }) {
    const cat = await req.models.category.getById(category_id)
    if (!cat) {
      res.status(400).json({ error: 'Invalid category_id' })
      return null
    }
    if (cat.organization_id !== organization_id) {
      res.status(400).json({ error: 'category_id organization mismatch' })
      return null
    }
    return cat
  }

  async bulkUploadIngredients(req, res) {
    const file = req.files?.file
    if (!file) return res.status(400).json({ error: 'file is required' })

    const csvText = Buffer.isBuffer(file.data) ? file.data.toString('utf8') : String(file.data || '')

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
        category_id: r.category_id !== undefined && r.category_id !== '' ? Number(r.category_id) : undefined,
        item_code: r.item_code !== undefined && r.item_code !== '' ? Number(r.item_code) : undefined,
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

      const cat = await this._assertCategory(req, res, {
        organization_id: parsed.data.organization_id,
        category_id: parsed.data.category_id,
      })
      if (!cat) {
        failedCount++
        results.push({ row: i + 1, ok: false, error: 'Invalid category_id' })
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
  }

  /**
   * POST /ingredients/bulk
   * Body: { items: IngredientCreate[] } | IngredientCreate[]
   *
   * Transaction-based bulk insert that skips failed rows but commits successful ones.
   * Returns counts and failure names for UI display.
   */
  async bulkCreateIngredients(req, res) {
    const raw = req.body
    const items = Array.isArray(raw) ? raw : Array.isArray(raw?.items) ? raw.items : null
    if (!items) return res.status(400).json({ error: 'items array is required' })

    const normalizeName = (v) => String(v ?? '').trim().toLowerCase()

    // Fetch existing ingredient names for org and prevent duplicates.
    const existingNames = await req.models.ingredient.listNamesByOrganization(req.user.organization_id)
    const existingSet = new Set(existingNames.map(normalizeName).filter(Boolean))
    const seenInBatch = new Set()

    /** @type {Array<any>} */
    const normalizedInputs = items.map((r) => ({
      ...r,
      organization_id: req.user.organization_id,
    }))

    // Validate upfront and capture row-level failures.
    const valid = []
    const failures = []

    // Cache category checks to avoid repeated DB calls.
    const categoryCache = new Map()

    for (let i = 0; i < normalizedInputs.length; i++) {
      const input = normalizedInputs[i]
      const parsed = IngredientCreateSchema.safeParse(input)
      if (!parsed.success) {
        failures.push({
          row: i + 1,
          name: String(input?.name ?? '').trim() || null,
          error: 'Invalid payload',
        })
        continue
      }

      const normName = normalizeName(parsed.data.name)
      if (normName && existingSet.has(normName)) {
        failures.push({
          row: i + 1,
          name: String(parsed.data?.name ?? '').trim() || null,
          error: 'Duplicate name (already exists)',
        })
        continue
      }
      if (normName && seenInBatch.has(normName)) {
        failures.push({
          row: i + 1,
          name: String(parsed.data?.name ?? '').trim() || null,
          error: 'Duplicate name (in bulk list)',
        })
        continue
      }

      const catId = parsed.data.category_id
      if (!categoryCache.has(catId)) {
        const cat = await req.models.category.getById(catId)
        const ok = Boolean(cat && cat.organization_id === parsed.data.organization_id)
        categoryCache.set(catId, ok)
        if (!ok) {
          failures.push({
            row: i + 1,
            name: String(parsed.data?.name ?? '').trim() || null,
            error: 'Invalid category_id',
          })
          continue
        }
      } else if (!categoryCache.get(catId)) {
        failures.push({
          row: i + 1,
          name: String(parsed.data?.name ?? '').trim() || null,
          error: 'Invalid category_id',
        })
        continue
      }

      valid.push({ row: i + 1, data: parsed.data })
      if (normName) seenInBatch.add(normName)
    }

    const bulkResult = await req.models.ingredient.bulkCreate(valid.map((v) => v.data))

    // Merge DAL failures with validation failures.
    const mergedFailures = [
      ...failures,
      ...(bulkResult.failures || []).map((f) => ({
        row: null,
        name: f.name ?? null,
        error: f.error ?? 'Failed',
      })),
    ]

    return res.json({
      total: normalizedInputs.length,
      created: bulkResult.created || 0,
      failed: mergedFailures.length,
      failures: mergedFailures,
    })
  }

  /**
   * PUT /ingredients/bulk
   * Body: { items: IngredientBulkUpdate[] } | IngredientBulkUpdate[]
   *
   * Applies partial updates to multiple ingredients (per row), commits successful rows, and reports failures.
   */
  async bulkUpdateIngredients(req, res) {
    const raw = req.body
    const items = Array.isArray(raw) ? raw : Array.isArray(raw?.items) ? raw.items : null
    if (!items) return res.status(400).json({ error: 'items array is required' })

    const BulkUpdateRowSchema = z
      .object({
        id: z.coerce.number().int().positive(),
      })
      .merge(IngredientUpdateSchema)

    const failures = []
    const valid = []

    const categoryCache = new Map()
    const ingredientCache = new Map()

    for (let i = 0; i < items.length; i++) {
      const input = items[i] || {}

      const parsed = BulkUpdateRowSchema.safeParse(input)
      if (!parsed.success) {
        failures.push({
          row: i + 1,
          id: Number(input?.id) || null,
          name: String(input?.name ?? '').trim() || null,
          error: 'Invalid payload',
        })
        continue
      }

      const id = parsed.data.id

      let existing = ingredientCache.get(id)
      if (existing === undefined) {
        existing = await req.models.ingredient.getById(id)
        ingredientCache.set(id, existing || null)
      }

      if (!existing) {
        failures.push({
          row: i + 1,
          id,
          name: String(parsed.data?.name ?? '').trim() || null,
          error: 'Not found',
        })
        continue
      }

      if (existing.organization_id !== req.user.organization_id) {
        failures.push({
          row: i + 1,
          id,
          name: String(parsed.data?.name ?? existing?.name ?? '').trim() || null,
          error: 'Ingredient organization mismatch',
        })
        continue
      }

      const updateData = { ...parsed.data }
      delete updateData.id

      if (!Object.keys(updateData).length) {
        failures.push({
          row: i + 1,
          id,
          name: String(existing?.name ?? '').trim() || null,
          error: 'No fields to update',
        })
        continue
      }

      if (updateData.category_id !== undefined) {
        const catId = updateData.category_id
        if (!categoryCache.has(catId)) {
          const cat = await req.models.category.getById(catId)
          const ok = Boolean(cat && cat.organization_id === req.user.organization_id)
          categoryCache.set(catId, ok)
          if (!ok) {
            failures.push({
              row: i + 1,
              id,
              name: String(updateData?.name ?? existing?.name ?? '').trim() || null,
              error: 'Invalid category_id',
            })
            continue
          }
        } else if (!categoryCache.get(catId)) {
          failures.push({
            row: i + 1,
            id,
            name: String(updateData?.name ?? existing?.name ?? '').trim() || null,
            error: 'Invalid category_id',
          })
          continue
        }
      }

      valid.push({
        row: i + 1,
        id,
        name: String(updateData?.name ?? existing?.name ?? '').trim() || null,
        data: updateData,
      })
    }

    const bulkResult = await req.models.ingredient.bulkUpdate(valid.map((v) => ({ id: v.id, name: v.name, data: v.data })))

    const mergedFailures = [
      ...failures,
      ...(bulkResult.failures || []).map((f) => ({
        row: null,
        id: f.id ?? null,
        name: f.name ?? null,
        error: f.error ?? 'Failed',
      })),
    ]

    return res.json({
      total: items.length,
      updated: bulkResult.updated || 0,
      failed: mergedFailures.length,
      failures: mergedFailures,
    })
  }

  async createIngredient(req, res) {
    const parsed = IngredientCreateSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' })

    const cat = await this._assertCategory(req, res, {
      organization_id: parsed.data.organization_id,
      category_id: parsed.data.category_id,
    })
    if (!cat) return

    const created = await req.models.ingredient.create(parsed.data)
    return res.json({ ingredient: created })
  }

  async getIngredientByItemCode(req, res) {
    const code = Number(req.params.item_code)
    if (!Number.isFinite(code) || code <= 0) return res.status(400).json({ error: 'Invalid item_code' })

    const item = await req.models.ingredient.getByItemCode({
      organization_id: req.user.organization_id,
      item_code: code,
    })
    if (!item) return res.status(404).json({ error: 'Not found' })
    return res.json({ ingredient: item })
  }

  async listIngredients(req, res) {
    const parsed = IngredientListQuerySchema.safeParse(req.query)
    if (!parsed.success) return res.status(400).json({ error: 'Invalid query' })

    const { items, total } = await req.models.ingredient.list({
      ...parsed.data,
      organization_id: req.user.organization_id,
    })

    const page = parsed.data.page
    const limit = parsed.data.limit
    const totalPages = limit > 0 ? (total === 0 ? 0 : Math.ceil(total / limit)) : 0
    const hasPrev = page > 1
    const hasNext = totalPages > 0 && page < totalPages

    return res.json({
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasPrev,
        hasNext,
        prevPage: hasPrev ? page - 1 : null,
        nextPage: hasNext ? page + 1 : null,
      },
      items,
    })
  }

  async getIngredientById(req, res) {
    const idParsed = IngredientIdSchema.safeParse(Number(req.params.id))
    if (!idParsed.success) return res.status(400).json({ error: 'Invalid id' })

    const item = await req.models.ingredient.getById(idParsed.data)
    if (!item) return res.status(404).json({ error: 'Not found' })
    return res.json({ ingredient: item })
  }

  async getIngredientRunningStock(req, res) {
    const idParsed = IngredientIdSchema.safeParse(Number(req.params.id))
    if (!idParsed.success) return res.status(400).json({ error: 'Invalid id' })

    const ingredient = await req.models.ingredient.getById(idParsed.data)
    if (!ingredient) return res.status(404).json({ error: 'Not found' })

    const QuerySchema = z.object({
      page: z.coerce.number().int().positive().default(1),
      limit: z.coerce.number().int().positive().max(1000).default(1000),
    })

    const qParsed = QuerySchema.safeParse(req.query)
    if (!qParsed.success) return res.status(400).json({ error: 'Invalid query' })

    const items = await req.models.runningStock.list({
      organization_id: req.user.organization_id,
      ingredient_id: idParsed.data,
      page: qParsed.data.page,
      limit: qParsed.data.limit,
    })

    return res.json({
      ingredient_id: idParsed.data,
      unit: ingredient.unit,
      items,
    })
  }

  async getIngredientRunningStockByOrigin(req, res) {
    const idParsed = IngredientIdSchema.safeParse(Number(req.params.id))
    if (!idParsed.success) return res.status(400).json({ error: 'Invalid id' })

    const originId = Number(req.params.origin_id)
    if (!Number.isFinite(originId) || originId <= 0)
      return res.status(400).json({ error: 'Invalid origin_id' })

    const ingredient = await req.models.ingredient.getById(idParsed.data)
    if (!ingredient) return res.status(404).json({ error: 'Not found' })

    const rows = await req.models.runningStock.list({
      organization_id: req.user.organization_id,
      ingredient_id: idParsed.data,
      origin_id: originId,
      page: 1,
      limit: 1,
    })

    const row = Array.isArray(rows) && rows.length ? rows[0] : null

    return res.json({
      ingredient_id: idParsed.data,
      origin_id: originId,
      unit: ingredient.unit,
      qty: row ? row.qty : 0,
      running_stock: row,
    })
  }

  async listIngredientStockTransitions(req, res) {
    const idParsed = IngredientIdSchema.safeParse(Number(req.params.id))
    if (!idParsed.success) return res.status(400).json({ error: 'Invalid id' })

    const ingredient = await req.models.ingredient.getById(idParsed.data)
    if (!ingredient) return res.status(404).json({ error: 'Not found' })

    const QuerySchema = z.object({
      page: z.coerce.number().int().positive().default(1),
      limit: z.coerce.number().int().positive().max(200).default(50),
      origin_id: z.coerce.number().int().positive().optional(),
      from_date: z.string().min(1).optional(),
      to_date: z.string().min(1).optional(),
    })

    const qParsed = QuerySchema.safeParse(req.query)
    if (!qParsed.success) return res.status(400).json({ error: 'Invalid query' })

    const items = await req.models.stockTransitionState.list({
      organization_id: req.user.organization_id,
      ingredient_id: idParsed.data,
      origin_id: qParsed.data.origin_id,
      from_date: qParsed.data.from_date,
      to_date: qParsed.data.to_date,
      page: qParsed.data.page,
      limit: qParsed.data.limit,
    })

    return res.json({
      ingredient_id: idParsed.data,
      unit: ingredient.unit,
      page: qParsed.data.page,
      limit: qParsed.data.limit,
      items,
    })
  }

  async updateIngredientById(req, res) {
    const idParsed = IngredientIdSchema.safeParse(Number(req.params.id))
    if (!idParsed.success) return res.status(400).json({ error: 'Invalid id' })

    const bodyParsed = IngredientUpdateSchema.safeParse(req.body)
    if (!bodyParsed.success) return res.status(400).json({ error: 'Invalid payload' })

    if (bodyParsed.data.category_id !== undefined) {
      const existing = await req.models.ingredient.getById(idParsed.data)
      if (!existing) return res.status(404).json({ error: 'Not found' })

      const cat = await this._assertCategory(req, res, {
        organization_id: existing.organization_id,
        category_id: bodyParsed.data.category_id,
      })
      if (!cat) return
    }

    const updated = await req.models.ingredient.updateById(idParsed.data, bodyParsed.data)
    if (!updated) return res.status(404).json({ error: 'Not found' })
    return res.json({ ingredient: updated })
  }

  async deleteIngredientById(req, res) {
    const idParsed = IngredientIdSchema.safeParse(Number(req.params.id))
    if (!idParsed.success) return res.status(400).json({ error: 'Invalid id' })

    const ok = await req.models.ingredient.deleteById(idParsed.data)
    return res.json({ ok: Boolean(ok) })
  }
}

const ingredientsController = new IngredientsController()

module.exports = { IngredientsController, ingredientsController }

