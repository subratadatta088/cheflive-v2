const { CategoryModel } = require('../../../models/CategoryModel')
const {
  CategoryCreateSchema,
  CategoryIdSchema,
  CategoryListQuerySchema,
  CategoryRowSchema,
  CategoryUpdateSchema,
} = require('../../../models/category/schema')
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

function all(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err)
      resolve(rows)
    })
  })
}

function normalizeCategoryRow(row) {
  const parsed = CategoryRowSchema.parse(row)
  const is_active =
    parsed.is_active === undefined || parsed.is_active === null ? 1 : Number(parsed.is_active)
  return { ...parsed, is_active }
}

class CategorySqliteDAL extends CategoryModel {
  constructor() {
    super()
    this.db = openSqlite()
  }

  async create(data) {
    const payload = CategoryCreateSchema.parse(data)
    const now = new Date().toISOString()
    const isActiveInt = payload.is_active === undefined ? 1 : payload.is_active ? 1 : 0

    const result = await run(
      this.db,
      `INSERT INTO categories (organization_id, name, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`,
      [payload.organization_id, payload.name, isActiveInt, now, now],
    )

    return await this.getById(result.lastID)
  }

  async getById(id) {
    const categoryId = CategoryIdSchema.parse(id)
    const row = await get(this.db, `SELECT * FROM categories WHERE id = ?`, [categoryId])
    if (!row) return null
    return normalizeCategoryRow(row)
  }

  async getAll() {
    const rows = await all(this.db, `SELECT * FROM categories`)
    return rows.map(normalizeCategoryRow)
  }

  async list(query) {
    const parsed = CategoryListQuerySchema.parse(query)

    const where = ['organization_id = ?']
    const params = [parsed.organization_id]

    if (parsed.q) {
      where.push('name LIKE ?')
      params.push(`%${parsed.q}%`)
    }

    if (parsed.is_active !== undefined) {
      const v = parsed.is_active === true || parsed.is_active === '1' || parsed.is_active === 1 ? 1 : 0
      where.push('is_active = ?')
      params.push(v)
    }
    if (parsed.deleted_at !== undefined) {
      where.push('deleted_at IS NULL')
    }

    const offset = (parsed.page - 1) * parsed.limit
    const rows = await all(
      this.db,
      `SELECT * FROM categories
       WHERE ${where.join(' AND ')}
       ORDER BY id DESC
       LIMIT ? OFFSET ?`,
      [...params, parsed.limit, offset],
    )

    return rows.map(normalizeCategoryRow)
  }

  async updateById(id, data) {
    const categoryId = CategoryIdSchema.parse(id)
    const payload = CategoryUpdateSchema.parse(data)

    const fields = []
    const params = []

    if (payload.name !== undefined) {
      fields.push('name = ?')
      params.push(payload.name)
    }
    if (payload.is_active !== undefined) {
      fields.push('is_active = ?')
      params.push(payload.is_active ? 1 : 0)
    }

    fields.push('updated_at = ?')
    params.push(new Date().toISOString())

    await run(this.db, `UPDATE categories SET ${fields.join(', ')} WHERE id = ?`, [...params, categoryId])
    return await this.getById(categoryId)
  }

  async deleteById(id) {
    const categoryId = CategoryIdSchema.parse(id)
    const now = new Date().toISOString()
    await run(this.db, `UPDATE categories SET deleted_at = ?, updated_at = ? WHERE id = ?`, [now, now, categoryId])
    return true
  }
}

module.exports = { CategorySqliteDAL }

