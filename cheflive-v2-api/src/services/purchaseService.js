class PurchaseService {
  /**
   * @param {{ models: any, user: any }} ctx
   */
  constructor(ctx) {
    this.models = ctx?.models
    this.user = ctx?.user
  }

  async create(payload) {
    return await this.models.purchase.create(payload)
  }

  async list(query) {
    return await this.models.purchase.list(query)
  }

  async getById(id) {
    return await this.models.purchase.getById(id)
  }

  async updateById(id, payload) {
    return await this.models.purchase.updateById(id, payload)
  }

  async deleteById(id) {
    return await this.models.purchase.deleteById(id)
  }
}

module.exports = { PurchaseService }

