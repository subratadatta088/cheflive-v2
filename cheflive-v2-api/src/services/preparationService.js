const { PreparationCreateSchema, PreparationUpdateSchema } = require('../models/preparation/schema')

/**
 * @param {Record<string, unknown>} body
 * @param {number} organizationId
 */
function normalizeWritePayload(body, organizationId) {
  const base = { organization_id: organizationId }

  if (body?.preparation && typeof body.preparation === 'object') {
    const out = { ...base, ...body.preparation }
    if (body.items !== undefined) out.items = body.items
    return out
  }

  const { items, organization_id: _org, ...rest } = body ?? {}
  const out = { ...base, ...rest }
  if (items !== undefined) out.items = items
  return out
}

class PreparationService {
  /**
   * @param {{ models: any, user: any }} ctx
   */
  constructor(ctx) {
    this.models = ctx?.models
    this.user = ctx?.user
  }

  /**
   * @param {Record<string, unknown>} body
   * @param {number} organizationId
   */
  async create(body, organizationId) {
    const merged = normalizeWritePayload(body, organizationId)
    const payload = PreparationCreateSchema.parse(merged)
    return await this.models.preparation.create(payload)
  }

  async list(query) {
    return await this.models.preparation.list(query)
  }

  async getById(id) {
    return await this.models.preparation.getById(id)
  }

  /**
   * @param {number} id
   * @param {Record<string, unknown>} body
   * @param {number} organizationId
   */
  async updateById(id, body, organizationId) {
    const merged = normalizeWritePayload(body, organizationId)
    const { items, ...prepFields } = merged
    const payload = PreparationUpdateSchema.parse({
      ...prepFields,
      ...(items !== undefined ? { items } : {}),
    })
    return await this.models.preparation.updateById(id, payload)
  }

  async deleteById(id) {
    return await this.models.preparation.deleteById(id)
  }
}

module.exports = { PreparationService, normalizeWritePayload }
