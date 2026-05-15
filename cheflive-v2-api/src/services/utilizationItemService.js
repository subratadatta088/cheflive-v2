class UtilizationItemService {
  /**
   * @param {{ models: any, user: any }} ctx
   */
  constructor(ctx) {
    this.models = ctx?.models
    this.user = ctx?.user
  }

  async create(payload) {
    return await this.models.utilizationItem.create({
      ...payload,
      created_by: this.user?.id ?? null,
    })
  }

  async list(query) {
    return await this.models.utilizationItem.list(query)
  }

  async getById(id) {
    return await this.models.utilizationItem.getById(id)
  }

  async updateById(id, payload) {
    return await this.models.utilizationItem.updateById(id, payload)
  }

  async deleteById(id) {
    return await this.models.utilizationItem.deleteById(id)
  }
}

module.exports = { UtilizationItemService }
