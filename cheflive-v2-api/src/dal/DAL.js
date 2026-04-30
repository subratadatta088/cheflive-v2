class DAL {
  constructor() {
    if (new.target === DAL) {
      throw new Error('DAL is abstract and cannot be instantiated directly')
    }
  }

  /** @abstract */
  async create(_data) {
    throw new Error('Not implemented')
  }

  /** @abstract */
  async getById(_id) {
    throw new Error('Not implemented')
  }

  /** @abstract */
  async getAll() {
    throw new Error('Not implemented')
  }

  /** @abstract */
  async updateById(_id, _data) {
    throw new Error('Not implemented')
  }

  /** @abstract */
  async deleteById(_id) {
    throw new Error('Not implemented')
  }
}

module.exports = { DAL }
