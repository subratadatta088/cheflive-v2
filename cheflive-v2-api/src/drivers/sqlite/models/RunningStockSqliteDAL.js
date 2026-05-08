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
}

module.exports = { RunningStockSqliteDAL }
