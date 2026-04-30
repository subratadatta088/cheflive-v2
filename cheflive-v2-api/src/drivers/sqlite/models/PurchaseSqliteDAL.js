const { PurchaseModel } = require('../../../models/PurchaseModel')
const {
  PurchaseCreateSchema,
  PurchaseIdSchema,
  PurchaseRowSchema,
  PurchaseUpdateSchema,
} = require('../../../models/purchase/schema')
const { PurchaseItemRowSchema } = require('../../../models/purchaseItem/schema')
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

function exec(db, sql) {
  return new Promise((resolve, reject) => {
    db.exec(sql, (err) => {
      if (err) return reject(err)
      resolve()
    })
  })
}

async function withTransaction(db, fn) {
  await exec(db, 'BEGIN')
  try {
    const out = await fn()
    await exec(db, 'COMMIT')
    return out
  } catch (e) {
    try {
      await exec(db, 'ROLLBACK')
    } catch {
      // ignore
    }
    throw e
  }
}

function normalizePurchaseRow(row) {
  return PurchaseRowSchema.parse(row)
}

function normalizeItemRow(row) {
  return PurchaseItemRowSchema.parse(row)
}

class PurchaseSqliteDAL extends PurchaseModel {
  constructor() {
    super()
    this.db = openSqlite()
  }

  async create(data) {
    const payload = PurchaseCreateSchema.parse(data)
    const now = new Date().toISOString()

    return await withTransaction(this.db, async () => {
      const originRow = await get(
        this.db,
        `SELECT organization_id FROM origins WHERE id = ? AND (deleted_at IS NULL OR deleted_at = '')`,
        [payload.origin_id]
      )
      if (!originRow) throw new Error('Origin not found')
      if (Number(originRow.organization_id) !== payload.organization_id)
        throw new Error('Origin organization mismatch')

      if (Array.isArray(payload.items) && payload.items.length) {
        const ingredientIds = [...new Set(payload.items.map((i) => i.ingredient_id))]
        const placeholders = ingredientIds.map(() => '?').join(', ')
        const checkRow = await get(
          this.db,
          `SELECT COUNT(*) AS c FROM ingredients
           WHERE organization_id = ?
             AND id IN (${placeholders})
             AND (deleted_at IS NULL OR deleted_at = '')`,
          [payload.organization_id, ...ingredientIds]
        )
        if (Number(checkRow?.c || 0) !== ingredientIds.length)
          throw new Error('Ingredient organization mismatch')
      }

      const result = await run(
        this.db,
        `INSERT INTO purchases (organization_id, origin_id, date, note, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          payload.organization_id,
          payload.origin_id,
          payload.date,
          payload.note ?? null,
          now,
          now,
        ]
      )

      const purchaseId = result.lastID

      if (Array.isArray(payload.items) && payload.items.length) {
        for (const it of payload.items) {
          await run(
            this.db,
            `INSERT INTO purchase_items (organization_id, purchase_id, ingredient_id, qty, unit, unit_price, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              payload.organization_id,
              purchaseId,
              it.ingredient_id,
              it.qty,
              it.unit ?? null,
              it.unit_price ?? null,
              now,
              now,
            ]
          )
        }
      }

      return await this.getById(purchaseId)
    })
  }

  async getById(id) {
    const pid = PurchaseIdSchema.parse(id)
    const row = await get(this.db, `SELECT * FROM purchases WHERE id = ?`, [pid])
    if (!row) return null
    const purchase = normalizePurchaseRow(row)

    const itemRows = await all(
      this.db,
      `SELECT * FROM purchase_items
       WHERE organization_id = ?
         AND purchase_id = ?
         AND (deleted_at IS NULL OR deleted_at = '')`,
      [purchase.organization_id, purchase.id]
    )

    return {
      ...purchase,
      items: itemRows.map(normalizeItemRow),
    }
  }

  async getAll() {
    const rows = await all(this.db, `SELECT * FROM purchases`)
    return rows.map(normalizePurchaseRow)
  }

  async list({ organization_id, page, limit, q, origin_id }) {
    const where = ['organization_id = ?', `(deleted_at IS NULL OR deleted_at = '')`]
    const params = [organization_id]

    if (q) {
      where.push('note LIKE ?')
      params.push(`%${q}%`)
    }

    if (origin_id) {
      where.push('origin_id = ?')
      params.push(origin_id)
    }

    const offset = (page - 1) * limit

    const rows = await all(
      this.db,
      `SELECT * FROM purchases
       WHERE ${where.join(' AND ')}
       ORDER BY id DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    )

    const purchases = rows.map(normalizePurchaseRow)
    if (!purchases.length) return purchases.map((p) => ({ ...p, items: [] }))

    const purchaseIds = purchases.map((p) => p.id)
    const placeholders = purchaseIds.map(() => '?').join(', ')

    const itemRows = await all(
      this.db,
      `SELECT * FROM purchase_items
       WHERE organization_id = ?
         AND purchase_id IN (${placeholders})
         AND (deleted_at IS NULL OR deleted_at = '')`,
      [organization_id, ...purchaseIds]
    )

    const items = itemRows.map(normalizeItemRow)
    const byPurchase = new Map()
    for (const it of items) {
      const pid = it.purchase_id
      if (!pid) continue
      const arr = byPurchase.get(pid) || []
      arr.push(it)
      byPurchase.set(pid, arr)
    }

    return purchases.map((p) => ({
      ...p,
      items: byPurchase.get(p.id) || [],
    }))
  }

  async updateById(id, data) {
    const pid = PurchaseIdSchema.parse(id)
    const payload = PurchaseUpdateSchema.parse(data)

    const existing = await get(this.db, `SELECT * FROM purchases WHERE id = ?`, [pid])
    if (!existing) return null

    if (payload.origin_id !== undefined) {
      const originRow = await get(
        this.db,
        `SELECT organization_id FROM origins WHERE id = ? AND (deleted_at IS NULL OR deleted_at = '')`,
        [payload.origin_id]
      )
      if (!originRow) throw new Error('Origin not found')
      if (Number(originRow.organization_id) !== Number(existing.organization_id))
        throw new Error('Origin organization mismatch')
    }

    const fields = []
    const params = []

    if (payload.origin_id !== undefined) {
      fields.push('origin_id = ?')
      params.push(payload.origin_id)
    }
    if (payload.date !== undefined) {
      fields.push('date = ?')
      params.push(payload.date)
    }
    if (payload.note !== undefined) {
      fields.push('note = ?')
      params.push(payload.note)
    }

    fields.push('updated_at = ?')
    params.push(new Date().toISOString())

    await run(this.db, `UPDATE purchases SET ${fields.join(', ')} WHERE id = ?`, [...params, pid])

    return await this.getById(pid)
  }

  async deleteById(id) {
    const pid = PurchaseIdSchema.parse(id)
    const now = new Date().toISOString()
    await run(
      this.db,
      `UPDATE purchases SET deleted_at = ?, updated_at = ? WHERE id = ?`,
      [now, now, pid]
    )
    await run(
      this.db,
      `UPDATE purchase_items SET deleted_at = ?, updated_at = ? WHERE purchase_id = ?`,
      [now, now, pid]
    )
    return true
  }
}

module.exports = { PurchaseSqliteDAL }
