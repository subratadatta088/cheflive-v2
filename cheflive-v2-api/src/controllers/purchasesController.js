const {
  PurchaseAllItemsBodySchema,
  PurchaseCreateSchema,
  PurchaseGroupItemsBodySchema,
  PurchaseIdSchema,
  PurchaseListQuerySchema,
  PurchaseUpdateSchema,
} = require('../models/purchase/schema')
const { PurchaseService } = require('../services/purchaseService')

function isSuperAdmin(req) {
  return Array.isArray(req.user?.roles) && req.user.roles.includes('superadmin')
}

class PurchasesController {
  create = async (req, res) => {
    const body = { ...req.body }

    if (isSuperAdmin(req)) {
      if (!body.organization_id)
        return res.status(400).json({ error: 'organization_id is required' })
    } else {
      body.organization_id = req.user.organization_id
    }

    const parsed = PurchaseCreateSchema.safeParse(body)
    if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' })

    try {
      const service = new PurchaseService({ models: req.models, user: req.user })
      const created = await service.create(parsed.data)
      return res.json({ purchase: created })
    } catch (e) {
      const msg = String(e?.message || '')
      if (msg.includes('Origin not found')) return res.status(400).json({ error: 'Origin not found' })
      if (msg.includes('Origin organization mismatch'))
        return res.status(400).json({ error: 'Origin organization mismatch' })
      if (msg.includes('Ingredient organization mismatch'))
        return res.status(400).json({ error: 'Ingredient organization mismatch' })
      if (msg.includes('transfer_to must differ')) return res.status(400).json({ error: msg })
      if (msg.includes('Invalid transfer_to')) return res.status(400).json({ error: msg })
      throw e
    }
  }

  list = async (req, res) => {
    const parsed = PurchaseListQuerySchema.safeParse(req.query)
    if (!parsed.success) return res.status(400).json({ error: 'Invalid query' })

    const query = { ...parsed.data }

    if (isSuperAdmin(req)) {
      if (!query.organization_id)
        return res.status(400).json({ error: 'organization_id is required' })
    } else {
      query.organization_id = req.user.organization_id
    }

    const service = new PurchaseService({ models: req.models, user: req.user })
    const items = await service.list(query)
    return res.json({
      page: query.page,
      limit: query.limit,
      items,
    })
  }

  getById = async (req, res) => {
    const idParsed = PurchaseIdSchema.safeParse(Number(req.params.id))
    if (!idParsed.success) return res.status(400).json({ error: 'Invalid id' })

    const service = new PurchaseService({ models: req.models, user: req.user })
    const item = await service.getById(idParsed.data)
    if (!item) return res.status(404).json({ error: 'Not found' })
    return res.json({ purchase: item })
  }

  updateById = async (req, res) => {
    const idParsed = PurchaseIdSchema.safeParse(Number(req.params.id))
    if (!idParsed.success) return res.status(400).json({ error: 'Invalid id' })

    const bodyParsed = PurchaseUpdateSchema.safeParse(req.body)
    if (!bodyParsed.success) return res.status(400).json({ error: 'Invalid payload' })

    try {
      const service = new PurchaseService({ models: req.models, user: req.user })
      const updated = await service.updateById(idParsed.data, bodyParsed.data)
      if (!updated) return res.status(404).json({ error: 'Not found' })
      return res.json({ purchase: updated })
    } catch (e) {
      const msg = String(e?.message || '')
      if (msg.includes('Origin not found')) return res.status(400).json({ error: 'Origin not found' })
      if (msg.includes('Origin organization mismatch'))
        return res.status(400).json({ error: 'Origin organization mismatch' })
      throw e
    }
  }

  deleteById = async (req, res) => {
    const idParsed = PurchaseIdSchema.safeParse(Number(req.params.id))
    if (!idParsed.success) return res.status(400).json({ error: 'Invalid id' })

    const service = new PurchaseService({ models: req.models, user: req.user })
    const ok = await service.deleteById(idParsed.data)
    return res.json({ ok: Boolean(ok) })
  }

  /**
   * POST /purchases/grouped-items
   * Body: { ids: number[], organization_id?: number (superadmin only) }
   *
   * Returns line items across the given purchases, grouped by ingredient, joined with the
   * `ingredients` table. Output shape mirrors the per-item shape returned by the list/getById
   * endpoints (ingredient_id, ingredient_name, qty, unit, unit_price), with qty/unit_price
   * normalized to each ingredient's default unit.
   */
  getItemsByLowStock = async (req, res) => {
    let organization_id
    if (isSuperAdmin(req)) {
      organization_id = Number(req.query?.organization_id)
      if (!Number.isFinite(organization_id) || organization_id <= 0)
        return res.status(400).json({ error: 'organization_id is required' })
    } else {
      organization_id = req.user.organization_id
    }

    const service = new PurchaseService({ models: req.models, user: req.user })
    const result = await service.getItemsByLowStock({ organization_id })
    return res.json(result)
  }

  groupItemsByIngredient = async (req, res) => {
    const parsed = PurchaseGroupItemsBodySchema.safeParse(req.body ?? {})
    if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' })

    let organization_id
    if (isSuperAdmin(req)) {
      organization_id = Number(parsed.data.organization_id)
      if (!Number.isFinite(organization_id) || organization_id <= 0)
        return res.status(400).json({ error: 'organization_id is required' })
    } else {
      organization_id = req.user.organization_id
    }

    try {
      const service = new PurchaseService({ models: req.models, user: req.user })
      const result = await service.groupItemsByIngredient({
        organization_id,
        purchase_ids: parsed.data.ids,
      })
      return res.json(result)
    } catch (e) {
      if (e?.code === 'UNIT_CONVERSION_NOT_FOUND') {
        return res.status(400).json({ error: String(e.message) })
      }
      throw e
    }
  }

  getAllItems = async (req, res) => {
    const parsed = PurchaseAllItemsBodySchema.safeParse(req.body ?? {})
    if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' })

    let organization_id
    if (isSuperAdmin(req)) {
      organization_id = Number(parsed.data.organization_id)
      if (!Number.isFinite(organization_id) || organization_id <= 0)
        return res.status(400).json({ error: 'organization_id is required' })
    } else {
      organization_id = req.user.organization_id
    }

    const service = new PurchaseService({ models: req.models, user: req.user })
    const result = await service.getAllItems({
      organization_id,
      purchase_ids: parsed.data.ids,
    })
    return res.json(result)
  }
}

module.exports = { PurchasesController }

