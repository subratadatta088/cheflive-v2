const { PreparationModel } = require('../../../models/PreparationModel')
const {
  PreparationCreateSchema,
  PreparationIdSchema,
  PreparationRowSchema,
  PreparationUpdateSchema,
} = require('../../../models/preparation/schema')
const { PreparationItemRowSchema } = require('../../../models/preparationItem/schema')
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

function exec(db, sql, params = []) {
  if (!params.length) {
    return new Promise((resolve, reject) => {
      db.exec(sql, (err) => {
        if (err) return reject(err)
        resolve()
      })
    })
  }

  return new Promise((resolve, reject) => {
    db.run(sql, params, (err) => {
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
      // ignore rollback failure
    }
    throw e
  }
}

function normalizePreparationRow(row) {
  const parsed = PreparationRowSchema.parse(row)

  let tags = null
  if (typeof parsed.tags === 'string') {
    try {
      tags = JSON.parse(parsed.tags)
    } catch {
      tags = null
    }
  } else if (Array.isArray(parsed.tags)) {
    tags = parsed.tags
  }

  const is_active =
    parsed.is_active === undefined || parsed.is_active === null
      ? 1
      : Number(parsed.is_active)

  return { ...parsed, tags, is_active }
}

class PreparationSqliteDAL extends PreparationModel {
  constructor() {
    super()
    this.db = openSqlite()
  }

  async create(data) {
    const payload = PreparationCreateSchema.parse(data)
    const now = new Date().toISOString()

    const tagsJson = payload.tags ? JSON.stringify(payload.tags) : null
    const isActiveInt =
      payload.is_active === undefined ? 1 : payload.is_active ? 1 : 0

    return await withTransaction(this.db, async () => {
      if (Array.isArray(payload.items) && payload.items.length) {
        const ingredientIds = Array.from(
          new Set(payload.items.map((i) => i.ingredient_id))
        )

        const placeholders = ingredientIds.map(() => '?').join(', ')
        const checkRow = await get(
          this.db,
          `SELECT COUNT(*) AS c
           FROM ingredients
           WHERE organization_id = ?
             AND id IN (${placeholders})`,
          [payload.organization_id, ...ingredientIds]
        )

        const count = Number(checkRow?.c || 0)
        if (count !== ingredientIds.length) {
          throw new Error('Ingredient organization mismatch')
        }
      }

      const result = await run(
        this.db,
        `INSERT INTO preparations (organization_id, name, type, qty, unit, tags, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          payload.organization_id,
          payload.name,
          payload.type ?? null,
          payload.qty ?? null,
          payload.unit ?? null,
          tagsJson,
          isActiveInt,
          now,
          now,
        ]
      )

      const preparationId = result.lastID

      if (Array.isArray(payload.items) && payload.items.length) {
        for (const it of payload.items) {
          await run(
            this.db,
            `INSERT INTO preparation_items (organization_id, preparation_id, ingredient_id, qty, unit, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              payload.organization_id,
              preparationId,
              it.ingredient_id,
              it.qty ?? null,
              it.unit ?? null,
              now,
              now,
            ]
          )
        }
      }

      return await this.getById(preparationId)
    })
  }

  async getById(id) {
    const prepId = PreparationIdSchema.parse(id)
    const row = await get(this.db, `SELECT * FROM preparations WHERE id = ?`, [prepId])
    if (!row) return null
    return normalizePreparationRow(row)
  }

  async getAll() {
    const rows = await all(this.db, `SELECT * FROM preparations`)
    return rows.map(normalizePreparationRow)
  }

  async list({ organization_id, page, limit, q, type, is_active }) {
    const where = ['organization_id = ?']
    const params = [organization_id]

    if (q) {
      where.push('name LIKE ?')
      params.push(`%${q}%`)
    }

    if (type) {
      where.push('type = ?')
      params.push(type)
    }

    if (is_active !== undefined) {
      const v =
        is_active === true || is_active === '1' || is_active === 1 ? 1 : 0
      where.push('is_active = ?')
      params.push(v)
    }

    const offset = (page - 1) * limit

    const rows = await all(
      this.db,
      `SELECT * FROM preparations
       WHERE ${where.join(' AND ')}
       ORDER BY id DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    )

    const preps = rows.map(normalizePreparationRow)
    if (!preps.length) return preps

    const prepIds = preps.map((p) => p.id)
    const placeholders = prepIds.map(() => '?').join(', ')

    const itemRows = await all(
      this.db,
      `SELECT *
       FROM preparation_items
       WHERE organization_id = ?
         AND preparation_id IN (${placeholders})
         AND (deleted_at IS NULL OR deleted_at = '')`,
      [organization_id, ...prepIds]
    )

    const items = itemRows.map((r) => PreparationItemRowSchema.parse(r))
    const byPrep = new Map()
    for (const it of items) {
      const pid = it.preparation_id
      if (!pid) continue
      const arr = byPrep.get(pid) || []
      arr.push(it)
      byPrep.set(pid, arr)
    }

    return preps.map((p) => ({ ...p, items: byPrep.get(p.id) || [] }))
  }

  async updateById(id, data) {
    const prepId = PreparationIdSchema.parse(id)
    const payload = PreparationUpdateSchema.parse(data)

    const fields = []
    const params = []

    if (payload.organization_id !== undefined) {
      fields.push('organization_id = ?')
      params.push(payload.organization_id)
    }
    if (payload.name !== undefined) {
      fields.push('name = ?')
      params.push(payload.name)
    }
    if (payload.type !== undefined) {
      fields.push('type = ?')
      params.push(payload.type)
    }
    if (payload.qty !== undefined) {
      fields.push('qty = ?')
      params.push(payload.qty)
    }
    if (payload.unit !== undefined) {
      fields.push('unit = ?')
      params.push(payload.unit)
    }
    if (payload.tags !== undefined) {
      fields.push('tags = ?')
      params.push(payload.tags === null ? null : JSON.stringify(payload.tags))
    }
    if (payload.is_active !== undefined) {
      fields.push('is_active = ?')
      params.push(payload.is_active ? 1 : 0)
    }

    fields.push('updated_at = ?')
    params.push(new Date().toISOString())

    await run(
      this.db,
      `UPDATE preparations SET ${fields.join(', ')} WHERE id = ?`,
      [...params, prepId]
    )

    return await this.getById(prepId)
  }

  async deleteById(id) {
    const prepId = PreparationIdSchema.parse(id)
    const now = new Date().toISOString()
    await run(
      this.db,
      `UPDATE preparations SET deleted_at = ?, updated_at = ? WHERE id = ?`,
      [now, now, prepId]
    )
    return true
  }
}

module.exports = { PreparationSqliteDAL }

