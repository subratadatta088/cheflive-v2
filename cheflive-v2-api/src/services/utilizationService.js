const { events, EventTypes } = require('../events')

class UtilizationService {
  /**
   * @param {{ models: any, user: any }} ctx
   */
  constructor(ctx) {
    this.models = ctx?.models
    this.user = ctx?.user
  }

  async create(payload) {
    const created = await this.models.utilization.create({
      ...payload,
      created_by: this.user?.id ?? null,
    })
    events.emit(EventTypes.UtilizationEntryCreated, {
      organization_id: created.organization_id,
      utilization_id: created.id,
      actor_user_id: this.user?.id ?? null,
      occurred_at: created.date || new Date().toISOString(),
    })
    return created
  }

  async list(query) {
    return await this.models.utilization.list(query)
  }

  async getById(id) {
    return await this.models.utilization.getById(id)
  }

  async updateById(id, payload) {
    const previous = await this.models.utilization.getById(id)
    const updated = await this.models.utilization.updateById(id, payload)
    if (!updated) return null

    events.emit(EventTypes.UtilizationEntryUpdated, {
      organization_id: updated.organization_id,
      utilization_id: updated.id,
      actor_user_id: this.user?.id ?? null,
      occurred_at: updated.date || new Date().toISOString(),
      previous,
      next: updated,
    })

    return updated
  }

  async deleteById(id) {
    const previous = await this.models.utilization.getById(id)
    const ok = await this.models.utilization.deleteById(id)

    events.emit(EventTypes.UtilizationEntryDeleted, {
      organization_id: previous?.organization_id ?? this.user?.organization_id ?? null,
      utilization_id: Number(id),
      actor_user_id: this.user?.id ?? null,
      occurred_at: new Date().toISOString(),
      previous,
    })

    return ok
  }
}

module.exports = { UtilizationService }
