const { TransferItemModel } = require('../../../models/TransferItemModel')
const {
  TransferItemCreateSchema,
  TransferItemIdSchema,
  TransferItemListQuerySchema,
  TransferItemRowSchema,
  TransferItemUpdateSchema,
} = require('../../../models/transferItem/schema')
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
  return TransferItemRowSchema.parse(row)
}

class TransferItemSqliteDAL extends TransferItemModel {
  constructor() {
    super()
    this.db = openSqlite()
  }

  async create(data) {
    const payload = TransferItemCreateSchema.parse(data)
    const now = new Date().toISOString()

    const transferRow = await get(
      this.db,
      `SELECT organization_id FROM transfers WHERE id = ? AND (deleted_at IS NULL OR deleted_at = '')`,
      [payload.transfer_id]
    )
    if (!transferRow) throw new Error('Transfer not found')
    if (Number(transferRow.organization_id) !== payload.organization_id)
      throw new Error('Transfer organization mismatch')

    const ingRow = await get(
      this.db,
      `SELECT organization_id FROM ingredients WHERE id = ? AND (deleted_at IS NULL OR deleted_at = '')`,
      [payload.ingredient_id]
    )
    if (!ingRow) throw new Error('Ingredient not found')
    if (Number(ingRow.organization_id) !== payload.organization_id)
      throw new Error('Ingredient organization mismatch')

    const result = await run(
      this.db,
      `INSERT INTO transfer_items (organization_id, transfer_id, ingredient_id, qty, unit_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        payload.organization_id,
        payload.transfer_id,
        payload.ingredient_id,
        payload.qty,
        payload.unit_id ?? null,
        now,
        now,
      ]
    )

    return await this.getById(result.lastID)
  }

  async getById(id) {
    const itemId = TransferItemIdSchema.parse(id)
    const row = await get(this.db, `SELECT * FROM transfer_items WHERE id = ?`, [itemId])
    if (!row) return null
    return normalizeRow(row)
  }

  async list(query) {
    const q = TransferItemListQuerySchema.parse(query)
    if (!q.organization_id) throw new Error('organization_id is required')

    const where = ['organization_id = ?', `(deleted_at IS NULL OR deleted_at = '')`]
    const params = [q.organization_id]

    if (q.transfer_id) {
      where.push('transfer_id = ?')
      params.push(q.transfer_id)
    }

    const offset = (q.page - 1) * q.limit

    const rows = await all(
      this.db,
      `SELECT * FROM transfer_items
       WHERE ${where.join(' AND ')}
       ORDER BY id DESC
       LIMIT ? OFFSET ?`,
      [...params, q.limit, offset]
    )

    return rows.map(normalizeRow)
  }

  async updateById(id, data) {
    const itemId = TransferItemIdSchema.parse(id)
    const payload = TransferItemUpdateSchema.parse(data)

    const fields = []
    const params = []

    if (payload.qty !== undefined) {
      fields.push('qty = ?')
      params.push(payload.qty)
    }
    if (payload.unit_id !== undefined) {
      fields.push('unit_id = ?')
      params.push(payload.unit_id)
    }

    fields.push('updated_at = ?')
    params.push(new Date().toISOString())

    await run(this.db, `UPDATE transfer_items SET ${fields.join(', ')} WHERE id = ?`, [
      ...params,
      itemId,
    ])

    return await this.getById(itemId)
  }

  async deleteById(id) {
    const itemId = TransferItemIdSchema.parse(id)
    const now = new Date().toISOString()
    await run(this.db, `UPDATE transfer_items SET deleted_at = ?, updated_at = ? WHERE id = ?`, [
      now,
      now,
      itemId,
    ])
    return true
  }
}

module.exports = { TransferItemSqliteDAL }

