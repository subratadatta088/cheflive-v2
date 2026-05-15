const {
  UtilizationCreateSchema,
  UtilizationIdSchema,
  UtilizationListQuerySchema,
  UtilizationUpdateSchema,
} = require('../models/utilization/schema')
const { UtilizationService } = require('../services/utilizationService')

function isSuperAdmin(req) {
  return Array.isArray(req.user?.roles) && req.user.roles.includes('superadmin')
}

class UtilizationsController {
  create = async (req, res) => {
    const body = { ...req.body }

    if (isSuperAdmin(req)) {
      if (!body.organization_id) return res.status(400).json({ error: 'organization_id is required' })
    } else {
      body.organization_id = req.user.organization_id
    }

    const parsed = UtilizationCreateSchema.safeParse(body)
    if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' })

    try {
      const service = new UtilizationService({ models: req.models, user: req.user })
      const created = await service.create(parsed.data)
      return res.json({ utilization: created })
    } catch (e) {
      const msg = String(e?.message || '')
      if (msg.includes('Origin not found')) return res.status(400).json({ error: 'Origin not found' })
      if (msg.includes('Origin organization mismatch'))
        return res.status(400).json({ error: 'Origin organization mismatch' })
      if (msg.includes('Ingredient organization mismatch'))
        return res.status(400).json({ error: 'Ingredient organization mismatch' })
      if (msg.includes('Preparation not found')) return res.status(400).json({ error: 'Preparation not found' })
      if (msg.includes('Preparation organization mismatch'))
        return res.status(400).json({ error: 'Preparation organization mismatch' })
      throw e
    }
  }

  list = async (req, res) => {
    const parsed = UtilizationListQuerySchema.safeParse(req.query)
    if (!parsed.success) return res.status(400).json({ error: 'Invalid query' })

    const query = { ...parsed.data }
    if (isSuperAdmin(req)) {
      if (!query.organization_id) return res.status(400).json({ error: 'organization_id is required' })
    } else {
      query.organization_id = req.user.organization_id
    }

    const service = new UtilizationService({ models: req.models, user: req.user })
    const items = await service.list(query)
    return res.json({ page: query.page, limit: query.limit, items })
  }

  getById = async (req, res) => {
    const idParsed = UtilizationIdSchema.safeParse(Number(req.params.id))
    if (!idParsed.success) return res.status(400).json({ error: 'Invalid id' })

    const service = new UtilizationService({ models: req.models, user: req.user })
    const item = await service.getById(idParsed.data)
    if (!item) return res.status(404).json({ error: 'Not found' })
    return res.json({ utilization: item })
  }

  updateById = async (req, res) => {
    const idParsed = UtilizationIdSchema.safeParse(Number(req.params.id))
    if (!idParsed.success) return res.status(400).json({ error: 'Invalid id' })

    const bodyParsed = UtilizationUpdateSchema.safeParse(req.body)
    if (!bodyParsed.success) return res.status(400).json({ error: 'Invalid payload' })

    try {
      const service = new UtilizationService({ models: req.models, user: req.user })
      const updated = await service.updateById(idParsed.data, bodyParsed.data)
      if (!updated) return res.status(404).json({ error: 'Not found' })
      return res.json({ utilization: updated })
    } catch (e) {
      const msg = String(e?.message || '')
      if (msg.includes('Origin not found')) return res.status(400).json({ error: 'Origin not found' })
      if (msg.includes('Origin organization mismatch'))
        return res.status(400).json({ error: 'Origin organization mismatch' })
      if (msg.includes('Preparation not found')) return res.status(400).json({ error: 'Preparation not found' })
      if (msg.includes('Preparation organization mismatch'))
        return res.status(400).json({ error: 'Preparation organization mismatch' })
      throw e
    }
  }

  deleteById = async (req, res) => {
    const idParsed = UtilizationIdSchema.safeParse(Number(req.params.id))
    if (!idParsed.success) return res.status(400).json({ error: 'Invalid id' })

    const service = new UtilizationService({ models: req.models, user: req.user })
    const ok = await service.deleteById(idParsed.data)
    return res.json({ ok: Boolean(ok) })
  }
}

module.exports = { UtilizationsController }
