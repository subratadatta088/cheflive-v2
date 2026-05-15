const {
  PreparationIdSchema,
  PreparationListQuerySchema,
} = require('../models/preparation/schema')
const { PreparationService } = require('../services/preparationService')

function isSuperAdmin(req) {
  return Array.isArray(req.user?.roles) && req.user.roles.includes('superadmin')
}

function resolveOrganizationId(req, body) {
  if (isSuperAdmin(req)) {
    const orgId = Number(body?.organization_id ?? body?.preparation?.organization_id)
    if (!Number.isFinite(orgId) || orgId <= 0) return { error: 'organization_id is required' }
    return { organizationId: orgId }
  }
  const orgId = Number(req.user?.organization_id)
  if (!Number.isFinite(orgId) || orgId <= 0) return { error: 'organization_id is required' }
  return { organizationId: orgId }
}

function mapPreparationError(e, res) {
  const msg = String(e?.message || '')
  if (msg.includes('Ingredient organization mismatch'))
    return res.status(400).json({ error: 'Ingredient organization mismatch' })
  if (msg.includes('Preparation not found')) return res.status(404).json({ error: 'Preparation not found' })
  return null
}

class PreparationsController {
  create = async (req, res) => {
    const body = { ...req.body }
    const org = resolveOrganizationId(req, body)
    if (org.error) return res.status(400).json({ error: org.error })

    try {
      const service = new PreparationService({ models: req.models, user: req.user })
      const created = await service.create(body, org.organizationId)
      return res.json({ preparation: created })
    } catch (e) {
      if (e?.name === 'ZodError') return res.status(400).json({ error: 'Invalid payload' })
      const mapped = mapPreparationError(e, res)
      if (mapped) return mapped
      throw e
    }
  }

  list = async (req, res) => {
    const parsed = PreparationListQuerySchema.safeParse(req.query)
    if (!parsed.success) return res.status(400).json({ error: 'Invalid query' })

    const query = { ...parsed.data }

    if (isSuperAdmin(req)) {
      if (!query.organization_id)
        return res.status(400).json({ error: 'organization_id is required' })
    } else {
      query.organization_id = req.user.organization_id
    }

    const service = new PreparationService({ models: req.models, user: req.user })
    const items = await service.list(query)
    return res.json({
      page: query.page,
      limit: query.limit,
      items,
    })
  }

  getById = async (req, res) => {
    const idParsed = PreparationIdSchema.safeParse(Number(req.params.id))
    if (!idParsed.success) return res.status(400).json({ error: 'Invalid id' })

    const service = new PreparationService({ models: req.models, user: req.user })
    const item = await service.getById(idParsed.data)
    if (!item) return res.status(404).json({ error: 'Not found' })
    return res.json({ preparation: item })
  }

  updateById = async (req, res) => {
    const idParsed = PreparationIdSchema.safeParse(Number(req.params.id))
    if (!idParsed.success) return res.status(400).json({ error: 'Invalid id' })

    const body = { ...req.body }
    if (!isSuperAdmin(req)) delete body.organization_id
    if (body?.preparation && !isSuperAdmin(req)) delete body.preparation.organization_id

    const org = resolveOrganizationId(req, body)
    if (org.error) return res.status(400).json({ error: org.error })

    try {
      const service = new PreparationService({ models: req.models, user: req.user })
      const updated = await service.updateById(idParsed.data, body, org.organizationId)
      if (!updated) return res.status(404).json({ error: 'Not found' })
      return res.json({ preparation: updated })
    } catch (e) {
      if (e?.name === 'ZodError') return res.status(400).json({ error: 'Invalid payload' })
      const mapped = mapPreparationError(e, res)
      if (mapped) return mapped
      throw e
    }
  }

  deleteById = async (req, res) => {
    const idParsed = PreparationIdSchema.safeParse(Number(req.params.id))
    if (!idParsed.success) return res.status(400).json({ error: 'Invalid id' })

    const service = new PreparationService({ models: req.models, user: req.user })
    const ok = await service.deleteById(idParsed.data)
    return res.json({ ok: Boolean(ok) })
  }
}

module.exports = { PreparationsController }
