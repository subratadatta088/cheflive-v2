class StockService {
  /**
   * @param {{ models: any, user: any }} ctx
   */
  constructor(ctx) {
    this.models = ctx?.models
    this.user = ctx?.user
  }

  async list(query) {
    return await this.models.stock.list(query)
  }
}

module.exports = { StockService }
