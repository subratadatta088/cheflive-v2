const { PurchaseItemModel } = require('../../../models/PurchaseItemModel')
const {
  PurchaseItemCreateSchema,
  PurchaseItemIdSchema,
  PurchaseItemListQuerySchema,
  PurchaseItemRowSchema,
  PurchaseItemUpdateSchema,
} = require('../../../models/purchaseItem/schema')
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
  return PurchaseItemRowSchema.parse(row)
}

class PurchaseItemSqliteDAL extends PurchaseItemModel {
  constructor() {
    super()
    this.db = openSqlite()
  }

  async create(data) {
    const payload = PurchaseItemCreateSchema.parse(data)
    const now = new Date().toISOString()

    const purchaseRow = await get(
      this.db,
      `SELECT organization_id FROM purchases WHERE id = ? AND (deleted_at IS NULL OR deleted_at = '')`,
      [payload.purchase_id]
    )
    if (!purchaseRow) throw new Error('Purchase not found')
    if (Number(purchaseRow.organization_id) !== payload.organization_id)
      throw new Error('Purchase organization mismatch')

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
      `INSERT INTO purchase_items (organization_id, purchase_id, ingredient_id, qty, unit, unit_price, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        payload.organization_id,
        payload.purchase_id,
        payload.ingredient_id,
        payload.qty,
        payload.unit ?? null,
        payload.unit_price ?? null,
        now,
        now,
      ]
    )

    return await this.getById(result.lastID)
  }

  async getById(id) {
    const itemId = PurchaseItemIdSchema.parse(id)
    const row = await get(this.db, `SELECT * FROM purchase_items WHERE id = ?`, [itemId])
    if (!row) return null
    return normalizeRow(row)
  }

  async getAll() {
    const rows = await all(this.db, `SELECT * FROM purchase_items`)
    return rows.map(normalizeRow)
  }

  async list(query) {
    const q = PurchaseItemListQuerySchema.parse(query)
    if (!q.organization_id) throw new Error('organization_id is required')

    const where = ['organization_id = ?', `(deleted_at IS NULL OR deleted_at = '')`]
    const params = [q.organization_id]

    if (q.purchase_id) {
      where.push('purchase_id = ?')
      params.push(q.purchase_id)
    }

    const offset = (q.page - 1) * q.limit

    const rows = await all(
      this.db,
      `SELECT * FROM purchase_items
       WHERE ${where.join(' AND ')}
       ORDER BY id DESC
       LIMIT ? OFFSET ?`,
      [...params, q.limit, offset]
    )

    return rows.map(normalizeRow)
  }

  async updateById(id, data) {
    const itemId = PurchaseItemIdSchema.parse(id)
    const payload = PurchaseItemUpdateSchema.parse(data)

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
    if (payload.unit_price !== undefined) {
      fields.push('unit_price = ?')
      params.push(payload.unit_price)
    }

    fields.push('updated_at = ?')
    params.push(new Date().toISOString())

    await run(
      this.db,
      `UPDATE purchase_items SET ${fields.join(', ')} WHERE id = ?`,
      [...params, itemId]
    )

    return await this.getById(itemId)
  }

  async deleteById(id) {
    const itemId = PurchaseItemIdSchema.parse(id)
    const now = new Date().toISOString()
    await run(
      this.db,
      `UPDATE purchase_items SET deleted_at = ?, updated_at = ? WHERE id = ?`,
      [now, now, itemId]
    )
    return true
  }
}

module.exports = { PurchaseItemSqliteDAL }
