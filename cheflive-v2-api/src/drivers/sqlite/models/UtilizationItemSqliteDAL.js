const { UtilizationItemModel } = require('../../../models/UtilizationItemModel')
const {
  UtilizationItemApiRowSchema,
  UtilizationItemCreateInternalSchema,
  UtilizationItemIdSchema,
  UtilizationItemListQuerySchema,
  UtilizationItemUpdateSchema,
} = require('../../../models/utilizationItem/schema')
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

function normalizeApiRow(row) {
  return UtilizationItemApiRowSchema.parse(row)
}

async function fetchUtilizationItemJoinedById(db, itemId) {
  const id = UtilizationItemIdSchema.parse(itemId)
  return await get(
    db,
    `SELECT ui.*, i.name AS ingredient_name
     FROM utilization_items ui
     LEFT JOIN ingredients i
       ON i.id = ui.ingredient_id
      AND i.organization_id = ui.organization_id
      AND (i.deleted_at IS NULL OR i.deleted_at = '')
     WHERE ui.id = ?`,
    [id]
  )
}

async function loadParentUtilization(db, utilizationId) {
  return await get(
    db,
    `SELECT id, organization_id, origin_id, date, deleted_at
     FROM utilizations
     WHERE id = ?`,
    [utilizationId]
  )
}

class UtilizationItemSqliteDAL extends UtilizationItemModel {
  constructor() {
    super()
    this.db = openSqlite()
  }

  async create(data) {
    const payload = UtilizationItemCreateInternalSchema.parse(data)
    const now = new Date().toISOString()
    const created_by = payload.created_by ?? null

    return await withTransaction(this.db, async () => {
      const utilRow = await loadParentUtilization(this.db, payload.utilization_id)
      if (!utilRow || utilRow.deleted_at) throw new Error('Utilization not found')
      if (Number(utilRow.organization_id) !== payload.organization_id)
        throw new Error('Utilization organization mismatch')

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
        `INSERT INTO utilization_items (organization_id, utilization_id, ingredient_id, qty, unit, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          payload.organization_id,
          payload.utilization_id,
          payload.ingredient_id,
          payload.qty,
          payload.unit,
          created_by,
          now,
          now,
        ]
      )

      const created = await fetchUtilizationItemJoinedById(this.db, result.lastID)
      return created ? normalizeApiRow(created) : null
    })
  }

  async getById(id) {
    const row = await fetchUtilizationItemJoinedById(this.db, id)
    if (!row) return null
    return normalizeApiRow(row)
  }

  async list(query) {
    const q = UtilizationItemListQuerySchema.parse(query)
    if (!q.organization_id) throw new Error('organization_id is required')

    const where = ['ui.organization_id = ?', `(ui.deleted_at IS NULL OR ui.deleted_at = '')`]
    const params = [q.organization_id]

    if (q.utilization_id) {
      where.push('ui.utilization_id = ?')
      params.push(q.utilization_id)
    }

    const offset = (q.page - 1) * q.limit

    const rows = await all(
      this.db,
      `SELECT ui.*, i.name AS ingredient_name
       FROM utilization_items ui
       LEFT JOIN ingredients i
         ON i.id = ui.ingredient_id
        AND i.organization_id = ui.organization_id
        AND (i.deleted_at IS NULL OR i.deleted_at = '')
       WHERE ${where.join(' AND ')}
       ORDER BY ui.id DESC
       LIMIT ? OFFSET ?`,
      [...params, q.limit, offset]
    )

    return rows.map(normalizeApiRow)
  }

  async updateById(id, data) {
    const itemId = UtilizationItemIdSchema.parse(id)
    const payload = UtilizationItemUpdateSchema.parse(data)

    return await withTransaction(this.db, async () => {
      const existing = await get(this.db, `SELECT * FROM utilization_items WHERE id = ?`, [itemId])
      if (!existing) return null
      if (existing.deleted_at) return null

      await loadParentUtilization(this.db, existing.utilization_id)

      const now = new Date().toISOString()

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
      params.push(now)

      await run(this.db, `UPDATE utilization_items SET ${fields.join(', ')} WHERE id = ?`, [
        ...params,
        itemId,
      ])

      const updated = await fetchUtilizationItemJoinedById(this.db, itemId)
      return updated ? normalizeApiRow(updated) : null
    })
  }

  async deleteById(id) {
    const itemId = UtilizationItemIdSchema.parse(id)
    const now = new Date().toISOString()

    return await withTransaction(this.db, async () => {
      const existing = await get(this.db, `SELECT * FROM utilization_items WHERE id = ?`, [itemId])
      if (!existing) return false
      if (existing.deleted_at) return true

      await loadParentUtilization(this.db, existing.utilization_id)

      await run(this.db, `UPDATE utilization_items SET deleted_at = ?, updated_at = ? WHERE id = ?`, [
        now,
        now,
        itemId,
      ])
      return true
    })
  }
}

module.exports = { UtilizationItemSqliteDAL }
