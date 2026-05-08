class RunningStockService {
  /**
   * @param {{ models: any, user: any }} ctx
   */
  constructor(ctx) {
    this.models = ctx?.models
    this.user = ctx?.user
  }

  async list(query) {
    return await this.models.runningStock.list(query)
  }

  async getById(id) {
    return await this.models.runningStock.getById(id)
  }
}

module.exports = { RunningStockService }
