const { RunningStockIdSchema, RunningStockListQuerySchema } = require('../models/runningStock/schema')
const { RunningStockService } = require('../services/runningStockService')

function isSuperAdmin(req) {
  return Array.isArray(req.user?.roles) && req.user.roles.includes('superadmin')
}

class RunningStockController {
  list = async (req, res) => {
    const parsed = RunningStockListQuerySchema.safeParse(req.query)
    if (!parsed.success) return res.status(400).json({ error: 'Invalid query' })

    const query = { ...parsed.data }
    if (isSuperAdmin(req)) {
      if (!query.organization_id) return res.status(400).json({ error: 'organization_id is required' })
    } else {
      query.organization_id = req.user.organization_id
    }

    const service = new RunningStockService({ models: req.models, user: req.user })
    const items = await service.list(query)
    return res.json({ page: query.page, limit: query.limit, items })
  }

  getById = async (req, res) => {
    const idParsed = RunningStockIdSchema.safeParse(Number(req.params.id))
    if (!idParsed.success) return res.status(400).json({ error: 'Invalid id' })

    const service = new RunningStockService({ models: req.models, user: req.user })
    const item = await service.getById(idParsed.data)
    if (!item) return res.status(404).json({ error: 'Not found' })
    return res.json({ running_stock: item })
  }
}

module.exports = { RunningStockController }

