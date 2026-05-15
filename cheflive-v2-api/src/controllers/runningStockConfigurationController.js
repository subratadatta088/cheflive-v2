const {
  RunningStockConfigQuerySchema,
  RunningStockConfigUpsertSchema,
} = require('../models/runningStock/schema')
const { RunningStockConfigurationService } = require('../services/runningStockConfigurationService')

function isSuperAdmin(req) {
  return Array.isArray(req.user?.roles) && req.user.roles.includes('superadmin')
}

class RunningStockConfigurationController {
  getConfiguration = async (req, res) => {
    const parsed = RunningStockConfigQuerySchema.safeParse(req.query)
    if (!parsed.success) return res.status(400).json({ error: 'Invalid query' })

    const query = { ...parsed.data }
    if (isSuperAdmin(req)) {
      if (!query.organization_id) return res.status(400).json({ error: 'organization_id is required' })
    } else {
      query.organization_id = req.user.organization_id
    }

    const service = new RunningStockConfigurationService({ models: req.models, user: req.user })
    const row = await service.getConfiguration(query)
    if (!row) {
      return res.json({
        ingredient_id: query.ingredient_id,
        origin_id: query.origin_id,
        configuration: null,
      })
    }
    return res.json({
      ingredient_id: query.ingredient_id,
      origin_id: query.origin_id,
      configuration: row,
    })
  }

  upsertConfiguration = async (req, res) => {
    const body = { ...req.body }
    if (isSuperAdmin(req)) {
      if (!body.organization_id) return res.status(400).json({ error: 'organization_id is required' })
    } else {
      body.organization_id = req.user.organization_id
    }

    const parsed = RunningStockConfigUpsertSchema.safeParse(body)
    if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' })

    try {
      const service = new RunningStockConfigurationService({ models: req.models, user: req.user })
      const saved = await service.upsertConfiguration({
        organization_id: parsed.data.organization_id ?? body.organization_id,
        origin_id: parsed.data.origin_id,
        ingredient_id: parsed.data.ingredient_id,
        opening_stock_qty: parsed.data.opening_stock_qty,
        reorder_threshold_qty: parsed.data.reorder_threshold_qty,
        minimum_reorder_qty: parsed.data.minimum_reorder_qty,
      })
      return res.json({ configuration: saved })
    } catch (e) {
      const msg = String(e?.message || '')
      if (msg.includes('Ingredient not found')) return res.status(400).json({ error: 'Ingredient not found' })
      if (msg.includes('Origin not found')) return res.status(400).json({ error: 'Origin not found' })
      throw e
    }
  }
}

module.exports = { RunningStockConfigurationController }
