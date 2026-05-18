const { StockListQuerySchema } = require('../models/stock/schema')
const { StockService } = require('../services/stockService')

function isSuperAdmin(req) {
  return Array.isArray(req.user?.roles) && req.user.roles.includes('superadmin')
}

class StockController {
  list = async (req, res) => {
    const parsed = StockListQuerySchema.safeParse(req.query)
    if (!parsed.success) return res.status(400).json({ error: 'Invalid query' })

    const query = { ...parsed.data }
    if (isSuperAdmin(req)) {
      if (!query.organization_id) return res.status(400).json({ error: 'organization_id is required' })
    } else {
      query.organization_id = req.user.organization_id
    }

    const service = new StockService({ models: req.models, user: req.user })
    const { items, total } = await service.list(query)

    const page = query.page
    const limit = query.limit
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
}

module.exports = { StockController }
