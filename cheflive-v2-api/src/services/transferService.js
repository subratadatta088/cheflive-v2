class TransferService {
  /**
   * @param {{ models: any, user: any }} ctx
   */
  constructor(ctx) {
    this.models = ctx?.models
    this.user = ctx?.user
  }

  async create(payload) {
    return await this.models.transfer.create(payload)
  }

  async list(query) {
    return await this.models.transfer.list(query)
  }

  async getById(id) {
    return await this.models.transfer.getById(id)
  }

  async updateById(id, payload) {
    return await this.models.transfer.updateById(id, payload)
  }

  async deleteById(id) {
    return await this.models.transfer.deleteById(id)
  }
}

module.exports = { TransferService }

