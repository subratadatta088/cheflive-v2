const {
  OriginCreateSchema,
  OriginIdSchema,
  OriginListQuerySchema,
  OriginUpdateSchema,
} = require('../models/origin/schema')

class OriginsController {
  constructor() {
    this.createOrigin = this.createOrigin.bind(this)
    this.listOrigins = this.listOrigins.bind(this)
    this.getOriginById = this.getOriginById.bind(this)
    this.updateOriginById = this.updateOriginById.bind(this)
    this.deleteOriginById = this.deleteOriginById.bind(this)
  }

  _isSuperAdmin(req) {
    return Array.isArray(req.user?.roles) && req.user.roles.includes('superadmin')
  }

  _isAdmin(req) {
    return Array.isArray(req.user?.roles) && (req.user.roles.includes('admin') || req.user.roles.includes('superadmin'))
  }

  _forbidden(res) {
    return res.status(403).json({ error: 403, message: 'You are not authorized to access this resource' })
  }

  async createOrigin(req, res) {
    if (!this._isAdmin(req)) return this._forbidden(res)

    const body = { ...req.body }

    if (this._isSuperAdmin(req)) {
      if (!body.organization_id) return res.status(400).json({ error: 'organization_id is required' })
    } else {
      body.organization_id = req.user.organization_id
    }

    const parsed = OriginCreateSchema.safeParse(body)
    if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' })

    const created = await req.models.origin.create(parsed.data)
    return res.json({ origin: created })
  }

  async listOrigins(req, res) {
    const parsed = OriginListQuerySchema.safeParse(req.query)
    if (!parsed.success) return res.status(400).json({ error: 'Invalid query' })

    const query = { ...parsed.data }

    if (this._isSuperAdmin(req)) {
      if (!query.organization_id) return res.status(400).json({ error: 'organization_id is required' })
    } else {
      query.organization_id = req.user.organization_id
    }

    const items = await req.models.origin.list(query)
    return res.json({ page: query.page, limit: query.limit, items })
  }

  async getOriginById(req, res) {
    const idParsed = OriginIdSchema.safeParse(Number(req.params.id))
    if (!idParsed.success) return res.status(400).json({ error: 'Invalid id' })

    const item = await req.models.origin.getById(idParsed.data)
    if (!item) return res.status(404).json({ error: 'Not found' })
    return res.json({ origin: item })
  }

  async updateOriginById(req, res) {
    if (!this._isAdmin(req)) return this._forbidden(res)

    const idParsed = OriginIdSchema.safeParse(Number(req.params.id))
    if (!idParsed.success) return res.status(400).json({ error: 'Invalid id' })

    const body = { ...req.body }
    if (!this._isSuperAdmin(req)) delete body.organization_id

    const bodyParsed = OriginUpdateSchema.safeParse(body)
    if (!bodyParsed.success) return res.status(400).json({ error: 'Invalid payload' })

    const updated = await req.models.origin.updateById(idParsed.data, bodyParsed.data)
    if (!updated) return res.status(404).json({ error: 'Not found' })
    return res.json({ origin: updated })
  }

  async deleteOriginById(req, res) {
    if (!this._isAdmin(req)) return this._forbidden(res)

    const idParsed = OriginIdSchema.safeParse(Number(req.params.id))
    if (!idParsed.success) return res.status(400).json({ error: 'Invalid id' })

    const ok = await req.models.origin.deleteById(idParsed.data)
    return res.json({ ok: Boolean(ok) })
  }
}

const originsController = new OriginsController()

module.exports = { OriginsController, originsController }

