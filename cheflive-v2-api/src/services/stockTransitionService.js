class StockTransitionService {
  /**
   * @param {{ models: any, user: any }} ctx
   */
  constructor(ctx) {
    this.models = ctx?.models
    this.user = ctx?.user
  }

  async create(payload) {
    return await this.models.stockTransitionState.create(payload)
  }
}

module.exports = { StockTransitionService }

