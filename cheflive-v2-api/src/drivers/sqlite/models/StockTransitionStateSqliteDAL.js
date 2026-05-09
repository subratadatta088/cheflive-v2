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
  return StockTransitionStateRowSchema.parse(row)
}

class StockTransitionStateSqliteDAL extends StockTransitionStateModel {
  constructor() {
    super()
    this.db = openSqlite()
  }

  async getById(id) {
    const stsId = StockTransitionStateIdSchema.parse(id)
    const row = await get(
      this.db,
      `SELECT * FROM stock_transition_states
       WHERE id = ?
         AND (deleted_at IS NULL OR deleted_at = '')`,
      [stsId]
    )
    if (!row) return null
    return normalizeRow(row)
  }

  async list(query) {
    const q = StockTransitionStateListQuerySchema.parse(query)
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

  async create(data) {
    const payload = StockTransitionStateRowSchema.omit({ id: true }).partial({ created_at: true }).parse(data)
    const now = new Date().toISOString()

    return await withTransaction(this.db, async () => {
      const result = await run(
        this.db,
        `INSERT INTO stock_transition_states (
          organization_id, origin_id, ingredient_id, unit,
          qty_before, qty_delta, qty_after,
          source_type,
          source_transfer_id, source_transfer_item_id,
          source_purchase_id, source_purchase_item_id,
          occurred_at, created_at, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          payload.organization_id,
          payload.origin_id,
          payload.ingredient_id,
          payload.unit,
          payload.qty_before,
          payload.qty_delta,
          payload.qty_after,
          payload.source_type,
          payload.source_transfer_id ?? null,
          payload.source_transfer_item_id ?? null,
          payload.source_purchase_id ?? null,
          payload.source_purchase_item_id ?? null,
          payload.occurred_at,
          payload.created_at ?? now,
          payload.created_by ?? null,
        ]
      )

      return await this.getById(result.lastID)
    })
  }
}

module.exports = { StockTransitionStateSqliteDAL }
