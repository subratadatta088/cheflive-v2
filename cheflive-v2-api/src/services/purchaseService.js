const { events, EventTypes } = require('../events')

class PurchaseService {
  /**
   * @param {{ models: any, user: any }} ctx
   */
  constructor(ctx) {
    this.models = ctx?.models
    this.user = ctx?.user
  }

  async create(payload) {
    const created = await this.models.purchase.create({
      ...payload,
      created_by: this.user?.id ?? null,
    })
    const transferTo =
      payload.transfer_to !== undefined && payload.transfer_to !== null
        ? Number(payload.transfer_to)
        : undefined
    events.emit(EventTypes.PurchaseEntryCreated, {
      organization_id: created.organization_id,
      purchase_id: created.id,
      actor_user_id: this.user?.id ?? null,
      occurred_at: created.date || new Date().toISOString(),
      ...(transferTo !== undefined && Number.isFinite(transferTo) && transferTo > 0
        ? { transfer_to: transferTo }
        : {}),
    })
    return created
  }

  async list(query) {
    return await this.models.purchase.list(query)
  }

  /**
   * Aggregate line items across multiple purchases, grouped by ingredient.
   * @param {{ organization_id: number, purchase_ids: number[] }} params
   */
  async groupItemsByIngredient(params) {
    return await this.models.purchase.groupItemsByIngredient(params)
  }

  async getItemsByLowStock(params) {
    return await this.models.purchase.getItemsByLowStock(params)
  }

  async getById(id) {
    return await this.models.purchase.getById(id)
  }

  async updateById(id, payload) {
    const previous = await this.models.purchase.getById(id)
    const updated = await this.models.purchase.updateById(id, payload)
    if (!updated) return null

    events.emit(EventTypes.PurchaseEntryUpdated, {
      organization_id: updated.organization_id,
      purchase_id: updated.id,
      actor_user_id: this.user?.id ?? null,
      occurred_at: updated.date || new Date().toISOString(),
      previous,
      next: updated,
    })

    return updated
  }

  async deleteById(id) {
    const previous = await this.models.purchase.getById(id)
    const ok = await this.models.purchase.deleteById(id)

    events.emit(EventTypes.PurchaseEntryDeleted, {
      organization_id: previous?.organization_id ?? this.user?.organization_id ?? null,
      purchase_id: Number(id),
      actor_user_id: this.user?.id ?? null,
      occurred_at: new Date().toISOString(),
      previous,
    })

    return ok
  }
}

module.exports = { PurchaseService }

