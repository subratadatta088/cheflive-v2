class StockTransitionStateService {
  /**
   * @param {{ models: any, user: any }} ctx
   */
  constructor(ctx) {
    this.models = ctx?.models
    this.user = ctx?.user
  }

  async list(query) {
    return await this.models.stockTransitionState.list(query)
  }

  async getById(id) {
    return await this.models.stockTransitionState.getById(id)
  }
}

module.exports = { StockTransitionStateService }
