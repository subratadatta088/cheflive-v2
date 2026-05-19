class StockService {
  /**
   * @param {{ models: any, user: any }} ctx
   */
  constructor(ctx) {
    this.models = ctx?.models
    this.user = ctx?.user
  }

  _eventMeta(overrides = {}) {
    return {
      actor_user_id: this.user?.id ?? null,
      ...overrides,
    }
  }

  async list(query) {
    return await this.models.stock.list(query)
  }

  /**
   * Apply stock movements for a newly created transfer.
   * @param {Record<string, unknown>} transfer
   */
  async applyTransfer(transfer) {
    const transferId = Number(transfer?.id)
    if (!Number.isFinite(transferId) || transferId <= 0) {
      throw new Error('Transfer id is required')
    }

    return await this.models.transfer.processTransferCreated(transferId, {
      ...this._eventMeta(),
      occurred_at: transfer.transfer_date || new Date().toISOString(),
    })
  }

  /**
   * Reverse prior transfer stock effects and apply the updated transfer.
   * @param {Record<string, unknown>} previous
   * @param {Record<string, unknown>} next
   */
  async applyTransferEditAdjustments(previous, next) {
    const transferId = Number(next?.id)
    if (!Number.isFinite(transferId) || transferId <= 0) {
      throw new Error('Transfer id is required')
    }

    return await this.models.transfer.processTransferUpdated(transferId, {
      ...this._eventMeta(),
      previous,
      next,
      occurred_at: next.transfer_date || new Date().toISOString(),
    })
  }

  /**
   * Reverse stock movements for a deleted transfer.
   * @param {Record<string, unknown>} previous
   */
  async revertTransfer(previous) {
    const transferId = Number(previous?.id)
    if (!Number.isFinite(transferId) || transferId <= 0) {
      throw new Error('Transfer id is required')
    }

    return await this.models.transfer.processTransferDeleted(transferId, {
      ...this._eventMeta(),
      previous,
      occurred_at: new Date().toISOString(),
    })
  }
}

module.exports = { StockService }
