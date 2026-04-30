const { z } = require('zod')
const { OrganizationModel } = require('../../../models/OrganizationModel')
const { openSqlite } = require('../db')

function run(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err)
      resolve({ lastID: this.lastID, changes: this.changes })
    })
  })
}

function get(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err)
      resolve(row)
    })
  })
}

const OrganizationCreateSchema = z.object({
  name: z.string().min(1),
})

const OrganizationRowSchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  created_at: z.string().optional().nullable(),
  updated_at: z.string().optional().nullable(),
  deleted_at: z.string().optional().nullable(),
})

class OrganizationSqliteDAL extends OrganizationModel {
  constructor() {
    super()
    this.db = openSqlite()
  }

  async create(data) {
    const payload = OrganizationCreateSchema.parse(data)
    const now = new Date().toISOString()
    const result = await run(
      this.db,
      `INSERT INTO organizations (name, created_at, updated_at) VALUES (?, ?, ?)`,
      [payload.name, now, now]
    )
    return await this.getById(result.lastID)
  }

  async getById(id) {
    const row = await get(this.db, `SELECT * FROM organizations WHERE id = ?`, [id])
    if (!row) return null
    return OrganizationRowSchema.parse(row)
  }

  async getAll() {
    throw new Error('Not implemented')
  }

  async updateById() {
    throw new Error('Not implemented')
  }

  async deleteById() {
    throw new Error('Not implemented')
  }
}

module.exports = { OrganizationSqliteDAL }
