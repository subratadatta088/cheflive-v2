class TransferItemService {
  /**
   * @param {{ models: any, user: any }} ctx
   */
  constructor(ctx) {
    this.models = ctx?.models
    this.user = ctx?.user
  }

  async create(payload) {
    return await this.models.transferItem.create(payload)
  }

  async list(query) {
    return await this.models.transferItem.list(query)
  }

  async getById(id) {
    return await this.models.transferItem.getById(id)
  }

  async updateById(id, payload) {
    return await this.models.transferItem.updateById(id, payload)
  }

  async deleteById(id) {
    return await this.models.transferItem.deleteById(id)
  }
}

module.exports = { TransferItemService }

