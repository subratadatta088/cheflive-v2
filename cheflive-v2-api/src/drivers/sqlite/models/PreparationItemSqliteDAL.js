const { PreparationItemModel } = require('../../../models/PreparationItemModel')
const {
  PreparationItemCreateSchema,
  PreparationItemIdSchema,
  PreparationItemListQuerySchema,
  PreparationItemRowSchema,
  PreparationItemUpdateSchema,
} = require('../../../models/preparationItem/schema')
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

function normalizeRow(row) {
  return PreparationItemRowSchema.parse(row)
}

class PreparationItemSqliteDAL extends PreparationItemModel {
  constructor() {
    super()
    this.db = openSqlite()
  }

  async create(data) {
    const payload = PreparationItemCreateSchema.parse(data)

    const prepRow = await get(
      this.db,
      `SELECT organization_id FROM preparations WHERE id = ?`,
      [payload.preparation_id]
    )
    if (!prepRow) throw new Error('Preparation not found')
    if (Number(prepRow.organization_id) !== payload.organization_id)
      throw new Error('Preparation organization mismatch')

    const ingRow = await get(
      this.db,
      `SELECT organization_id FROM ingredients WHERE id = ?`,
      [payload.ingredient_id]
    )
    if (!ingRow) throw new Error('Ingredient not found')
    if (Number(ingRow.organization_id) !== payload.organization_id)
      throw new Error('Ingredient organization mismatch')

    const now = new Date().toISOString()
    const result = await run(
      this.db,
      `INSERT INTO preparation_items (organization_id, preparation_id, ingredient_id, qty, unit, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        payload.organization_id,
        payload.preparation_id,
        payload.ingredient_id,
        payload.qty ?? null,
        payload.unit ?? null,
        now,
        now,
      ]
    )

    return await this.getById(result.lastID)
  }

  async getById(id) {
    const itemId = PreparationItemIdSchema.parse(id)
    const row = await get(this.db, `SELECT * FROM preparation_items WHERE id = ?`, [
      itemId,
    ])
    if (!row) return null
    return normalizeRow(row)
  }

  async getAll() {
    const rows = await all(this.db, `SELECT * FROM preparation_items`)
    return rows.map(normalizeRow)
  }

  async list(query) {
    const q = PreparationItemListQuerySchema.parse(query)
    if (!q.organization_id) throw new Error('organization_id is required')

    const where = ['pi.organization_id = ?', `(pi.deleted_at IS NULL OR pi.deleted_at = '')`]
    const params = [q.organization_id]

    if (q.preparation_id) {
      where.push('pi.preparation_id = ?')
      params.push(q.preparation_id)
    }

    const offset = (q.page - 1) * q.limit

    const rows = await all(
      this.db,
      `SELECT pi.*, i.name AS ingredient_name, i.item_code AS ingredient_item_code
       FROM preparation_items pi
       LEFT JOIN ingredients i
         ON i.id = pi.ingredient_id
        AND i.organization_id = pi.organization_id
        AND (i.deleted_at IS NULL OR i.deleted_at = '')
       WHERE ${where.join(' AND ')}
       ORDER BY pi.id ASC
       LIMIT ? OFFSET ?`,
      [...params, q.limit, offset]
    )

    const { PreparationItemApiRowSchema } = require('../../../models/preparationItem/schema')
    return rows.map((r) => PreparationItemApiRowSchema.parse(r))
  }

  async updateById(id, data) {
    const itemId = PreparationItemIdSchema.parse(id)
    const payload = PreparationItemUpdateSchema.parse(data)

    const fields = []
    const params = []

    if (payload.qty !== undefined) {
      fields.push('qty = ?')
      params.push(payload.qty)
    }
    if (payload.unit !== undefined) {
      fields.push('unit = ?')
      params.push(payload.unit)
    }

    fields.push('updated_at = ?')
    params.push(new Date().toISOString())

    await run(
      this.db,
      `UPDATE preparation_items SET ${fields.join(', ')} WHERE id = ?`,
      [...params, itemId]
    )

    return await this.getById(itemId)
  }

  async deleteById(id) {
    const itemId = PreparationItemIdSchema.parse(id)
    const now = new Date().toISOString()
    await run(
      this.db,
      `UPDATE preparation_items SET deleted_at = ?, updated_at = ? WHERE id = ?`,
      [now, now, itemId]
    )
    return true
  }
}

module.exports = { PreparationItemSqliteDAL }

