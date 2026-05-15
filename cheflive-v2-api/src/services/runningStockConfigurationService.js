class RunningStockConfigurationService {
  /**
   * @param {{ models: any, user: any }} ctx
   */
  constructor(ctx) {
    this.models = ctx?.models
    this.user = ctx?.user
  }

  async getConfiguration(query) {
    return await this.models.runningStock.getConfiguration(query)
  }

  async upsertConfiguration(payload) {
    return await this.models.runningStock.upsertConfiguration({
      ...payload,
      created_by: this.user?.id ?? null,
      updated_by: this.user?.id ?? null,
    })
  }
}

module.exports = { RunningStockConfigurationService }
