const { events, EventTypes } = require('../events')

class TransferService {
  /**
   * @param {{ models: any, user: any }} ctx
   */
  constructor(ctx) {
    this.models = ctx?.models
    this.user = ctx?.user
  }

  async create(payload) {
    const created = await this.models.transfer.create({
      ...payload,
      created_by: this.user?.id ?? null,
    })
    events.emit(EventTypes.TransferEntryCreated, {
      organization_id: created.organization_id,
      transfer_id: created.id,
      actor_user_id: this.user?.id ?? null,
      occurred_at: created.transfer_date || new Date().toISOString(),
    })
    return created
  }

  async list(query) {
    return await this.models.transfer.list(query)
  }

  async groupItemsByIngredient(params) {
    return await this.models.transfer.groupItemsByIngredient(params)
  }

  async getAllItems(params) {
    return await this.models.transfer.getAllItems(params)
  }

  async listByPurchaseId(organization_id, purchase_id) {
    return await this.models.transfer.listByPurchaseId({
      organization_id: Number(organization_id),
      purchase_id: Number(purchase_id),
    })
  }

  async listByUtilisationId(organization_id, utilisation_id) {
    return await this.models.transfer.listByUtilisationId({
      organization_id: Number(organization_id),
      utilisation_id: Number(utilisation_id),
    })
  }

  async getById(id) {
    return await this.models.transfer.getById(id)
  }

  async updateById(id, payload) {
    const previous = await this.models.transfer.getById(id)
    const updated = await this.models.transfer.updateById(id, payload)
    if (!updated) return null

    events.emit(EventTypes.TransferEntryUpdated, {
      organization_id: updated.organization_id,
      transfer_id: updated.id,
      actor_user_id: this.user?.id ?? null,
      occurred_at: updated.transfer_date || new Date().toISOString(),
      previous,
      next: updated,
    })

    return updated
  }

  async deleteById(id) {
    const previous = await this.models.transfer.getById(id)
    const ok = await this.models.transfer.deleteById(id)

    events.emit(EventTypes.TransferEntryDeleted, {
      organization_id: previous?.organization_id ?? this.user?.organization_id ?? null,
      transfer_id: Number(id),
      actor_user_id: this.user?.id ?? null,
      occurred_at: new Date().toISOString(),
      previous,
    })

    return ok
  }
}

module.exports = { TransferService }

