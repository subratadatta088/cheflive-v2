const {
  TransferCreateSchema,
  TransferGroupItemsBodySchema,
  TransferIdSchema,
  TransferListQuerySchema,
  TransferUpdateSchema,
} = require('../models/transfer/schema')
const { TransferService } = require('../services/transferService')

function isSuperAdmin(req) {
  return Array.isArray(req.user?.roles) && req.user.roles.includes('superadmin')
}

class TransfersController {
  create = async (req, res) => {
    const body = { ...req.body }

    if (isSuperAdmin(req)) {
      if (!body.organization_id) return res.status(400).json({ error: 'organization_id is required' })
    } else {
      body.organization_id = req.user.organization_id
    }

    const parsed = TransferCreateSchema.safeParse(body)
    if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' })

    try {
      const service = new TransferService({ models: req.models, user: req.user })
      const created = await service.create(parsed.data)
      return res.json({ transfer: created })
    } catch (e) {
      const msg = String(e?.message || '')
      if (msg.includes('Origin not found')) return res.status(400).json({ error: 'Origin not found' })
      if (msg.includes('Origin organization mismatch'))
        return res.status(400).json({ error: 'Origin organization mismatch' })
      if (msg.includes('Purchase not found')) return res.status(400).json({ error: 'Purchase not found' })
      if (msg.includes('Purchase organization mismatch'))
        return res.status(400).json({ error: 'Purchase organization mismatch' })
      if (msg.includes('Utilization not found')) return res.status(400).json({ error: 'Utilization not found' })
      if (msg.includes('Utilization organization mismatch'))
        return res.status(400).json({ error: 'Utilization organization mismatch' })
      if (msg.includes('Ingredient organization mismatch'))
        return res.status(400).json({ error: 'Ingredient organization mismatch' })
      throw e
    }
  }

  list = async (req, res) => {
    const parsed = TransferListQuerySchema.safeParse(req.query)
    if (!parsed.success) return res.status(400).json({ error: 'Invalid query' })

    const query = { ...parsed.data }
    if (isSuperAdmin(req)) {
      if (!query.organization_id) return res.status(400).json({ error: 'organization_id is required' })
    } else {
      query.organization_id = req.user.organization_id
    }

    const service = new TransferService({ models: req.models, user: req.user })
    const items = await service.list(query)
    return res.json({ page: query.page, limit: query.limit, items })
  }

  getById = async (req, res) => {
    const idParsed = TransferIdSchema.safeParse(Number(req.params.id))
    if (!idParsed.success) return res.status(400).json({ error: 'Invalid id' })

    const service = new TransferService({ models: req.models, user: req.user })
    const item = await service.getById(idParsed.data)
    if (!item) return res.status(404).json({ error: 'Not found' })
    return res.json({ transfer: item })
  }

  updateById = async (req, res) => {
    const idParsed = TransferIdSchema.safeParse(Number(req.params.id))
    if (!idParsed.success) return res.status(400).json({ error: 'Invalid id' })

    const bodyParsed = TransferUpdateSchema.safeParse(req.body)
    if (!bodyParsed.success) return res.status(400).json({ error: 'Invalid payload' })

    try {
      const service = new TransferService({ models: req.models, user: req.user })
      const updated = await service.updateById(idParsed.data, bodyParsed.data)
      if (!updated) return res.status(404).json({ error: 'Not found' })
      return res.json({ transfer: updated })
    } catch (e) {
      const msg = String(e?.message || '')
      if (msg.includes('Origin not found')) return res.status(400).json({ error: 'Origin not found' })
      if (msg.includes('Origin organization mismatch'))
        return res.status(400).json({ error: 'Origin organization mismatch' })
      if (msg.includes('Purchase not found')) return res.status(400).json({ error: 'Purchase not found' })
      if (msg.includes('Purchase organization mismatch'))
        return res.status(400).json({ error: 'Purchase organization mismatch' })
      if (msg.includes('Utilization not found')) return res.status(400).json({ error: 'Utilization not found' })
      if (msg.includes('Utilization organization mismatch'))
        return res.status(400).json({ error: 'Utilization organization mismatch' })
      throw e
    }
  }

  deleteById = async (req, res) => {
    const idParsed = TransferIdSchema.safeParse(Number(req.params.id))
    if (!idParsed.success) return res.status(400).json({ error: 'Invalid id' })

    const service = new TransferService({ models: req.models, user: req.user })
    const ok = await service.deleteById(idParsed.data)
    return res.json({ ok: Boolean(ok) })
  }

  groupItemsByIngredient = async (req, res) => {
    const parsed = TransferGroupItemsBodySchema.safeParse(req.body ?? {})
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
      const service = new TransferService({ models: req.models, user: req.user })
      const result = await service.groupItemsByIngredient({
        organization_id,
        transfer_ids: parsed.data.ids,
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
    const parsed = TransferGroupItemsBodySchema.safeParse(req.body ?? {})
    if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' })

    let organization_id
    if (isSuperAdmin(req)) {
      organization_id = Number(parsed.data.organization_id)
      if (!Number.isFinite(organization_id) || organization_id <= 0)
        return res.status(400).json({ error: 'organization_id is required' })
    } else {
      organization_id = req.user.organization_id
    }

    const service = new TransferService({ models: req.models, user: req.user })
    const result = await service.getAllItems({
      organization_id,
      transfer_ids: parsed.data.ids,
    })
    return res.json(result)
  }
}

module.exports = { TransfersController }

