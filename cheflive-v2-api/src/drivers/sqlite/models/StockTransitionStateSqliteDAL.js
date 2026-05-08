const { StockTransitionStateModel } = require('../../../models/StockTransitionStateModel')
const {
  StockTransitionStateIdSchema,
  StockTransitionStateListQuerySchema,
  StockTransitionStateRowSchema,
} = require('../../../models/stockTransitionState/schema')
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
  return StockTransitionStateRowSchema.parse(row)
}

class StockTransitionStateSqliteDAL extends StockTransitionStateModel {
  constructor() {
    super()
    this.db = openSqlite()
  }

  async getById(id) {
    const stsId = StockTransitionStateIdSchema.parse(id)
    const row = await get(this.db, `SELECT * FROM stock_transition_states WHERE id = ?`, [stsId])
    if (!row) return null
    return normalizeRow(row)
  }

  async list(query) {
    const q = StockTransitionStateListQuerySchema.parse(query)
    if (!q.organization_id) throw new Error('organization_id is required')

    const where = ['organization_id = ?']
    const params = [q.organization_id]

    if (q.origin_id) {
      where.push('origin_id = ?')
      params.push(q.origin_id)
    }
    if (q.ingredient_id) {
      where.push('ingredient_id = ?')
      params.push(q.ingredient_id)
    }
    if (q.source_transfer_id) {
      where.push('source_transfer_id = ?')
      params.push(q.source_transfer_id)
    }
    if (q.source_type) {
      where.push('source_type = ?')
      params.push(q.source_type)
    }
    if (q.from_date) {
      where.push('occurred_at >= ?')
      params.push(q.from_date)
    }
    if (q.to_date) {
      where.push('occurred_at <= ?')
      params.push(q.to_date)
    }

    const offset = (q.page - 1) * q.limit

    const rows = await all(
      this.db,
      `SELECT * FROM stock_transition_states
       WHERE ${where.join(' AND ')}
       ORDER BY id DESC
       LIMIT ? OFFSET ?`,
      [...params, q.limit, offset]
    )

    return rows.map(normalizeRow)
  }
}

module.exports = { StockTransitionStateSqliteDAL }
