const { RunningStockModel } = require('../../../models/RunningStockModel')
const {
  RunningStockIdSchema,
  RunningStockListQuerySchema,
  RunningStockRowSchema,
} = require('../../../models/runningStock/schema')
const { openSqlite } = require('../db')

function get(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err)
      resolve(row)
    })
  })
}

function run(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err)
      resolve({ lastID: this.lastID, changes: this.changes })
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

function all(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err)
      resolve(rows)
    })
  })
}

function normalizeRow(row) {
  return RunningStockRowSchema.parse(row)
}

class RunningStockSqliteDAL extends RunningStockModel {
  constructor() {
    super()
    this.db = openSqlite()
  }

  async getById(id) {
    const rsId = RunningStockIdSchema.parse(id)
    const row = await get(this.db, `SELECT * FROM running_stock WHERE id = ?`, [rsId])
    if (!row) return null
    return normalizeRow(row)
  }

  async list(query) {
    const q = RunningStockListQuerySchema.parse(query)
    if (!q.organization_id) throw new Error('organization_id is required')

    const where = ['organization_id = ?', `(deleted_at IS NULL OR deleted_at = '')`]
    const params = [q.organization_id]

    if (q.origin_id) {
      where.push('origin_id = ?')
      params.push(q.origin_id)
    }
    if (q.ingredient_id) {
      where.push('ingredient_id = ?')
      params.push(q.ingredient_id)
    }

    const offset = (q.page - 1) * q.limit

    const rows = await all(
      this.db,
      `SELECT * FROM running_stock
       WHERE ${where.join(' AND ')}
       ORDER BY id DESC
       LIMIT ? OFFSET ?`,
      [...params, q.limit, offset]
    )

    return rows.map(normalizeRow)
  }

  /**
   * Apply a qty delta to running_stock and return before/after.
   * This does NOT write stock_transition_states (handled by StockUpdated event).
   *
   * @param {{ organization_id: number, origin_id: number, ingredient_id: number, qty_delta: number, occurred_at?: string }} params
   * @returns {Promise<{ qty_before: number, qty_after: number, unit: string, running_stock_id: number }>}
   */
  async applyDelta(params) {
    const organization_id = Number(params.organization_id)
    const origin_id = Number(params.origin_id)
    const ingredient_id = Number(params.ingredient_id)
    const qty_delta = Number(params.qty_delta)

    if (!Number.isFinite(organization_id) || organization_id <= 0) throw new Error('organization_id is required')
    if (!Number.isFinite(origin_id) || origin_id <= 0) throw new Error('origin_id is required')
    if (!Number.isFinite(ingredient_id) || ingredient_id <= 0) throw new Error('ingredient_id is required')
    if (!Number.isFinite(qty_delta)) throw new Error('qty_delta must be finite')

    return await withTransaction(this.db, async () => {
      const ingRow = await get(
        this.db,
        `SELECT unit FROM ingredients WHERE id = ? AND organization_id = ? AND (deleted_at IS NULL OR deleted_at = '')`,
        [ingredient_id, organization_id]
      )
      if (!ingRow) throw new Error('Ingredient not found')
      const unit = String(ingRow.unit || '').trim()
      if (!unit) throw new Error('Ingredient default unit is missing')

      const existing = await get(
        this.db,
        `SELECT id, qty FROM running_stock WHERE organization_id = ? AND origin_id = ? AND ingredient_id = ?`,
        [organization_id, origin_id, ingredient_id]
      )

      const qty_before = existing ? Number(existing.qty) || 0 : 0
      const qty_after = qty_before + qty_delta
      const now = new Date().toISOString()

      let running_stock_id
      if (existing) {
        await run(
          this.db,
          `UPDATE running_stock SET qty = ?, unit = ?, updated_at = ?, deleted_at = NULL WHERE id = ?`,
          [qty_after, unit, now, existing.id]
        )
        running_stock_id = existing.id
      } else {
        const ins = await run(
          this.db,
          `INSERT INTO running_stock (organization_id, origin_id, ingredient_id, qty, unit, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [organization_id, origin_id, ingredient_id, qty_after, unit, now, now]
        )
        running_stock_id = ins.lastID
      }

      return { qty_before, qty_after, unit, running_stock_id }
    })
  }
}

module.exports = { RunningStockSqliteDAL }
