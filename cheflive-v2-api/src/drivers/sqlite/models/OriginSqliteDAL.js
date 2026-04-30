const { OriginModel } = require('../../../models/OriginModel')
const {
  OriginCreateSchema,
  OriginIdSchema,
  OriginRowSchema,
  OriginUpdateSchema,
} = require('../../../models/origin/schema')
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

function normalizeOriginRow(row) {
  const parsed = OriginRowSchema.parse(row)
  const is_active =
    parsed.is_active === undefined || parsed.is_active === null
      ? 1
      : Number(parsed.is_active)
  const is_default =
    parsed.is_default === undefined || parsed.is_default === null
      ? 0
      : Number(parsed.is_default)
  return { ...parsed, is_active, is_default }
}

class OriginSqliteDAL extends OriginModel {
  constructor() {
    super()
    this.db = openSqlite()
  }

  async create(data) {
    const payload = OriginCreateSchema.parse(data)
    const now = new Date().toISOString()
    const isActiveInt =
      payload.is_active === undefined ? 1 : payload.is_active ? 1 : 0
    const isDefaultInt =
      payload.is_default === undefined ? 0 : payload.is_default ? 1 : 0

    const result = await run(
      this.db,
      `INSERT INTO origins (organization_id, name, type, is_active, is_default, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        payload.organization_id,
        payload.name,
        payload.type,
        isActiveInt,
        isDefaultInt,
        now,
        now,
      ]
    )

    return await this.getById(result.lastID)
  }

  async getById(id) {
    const originId = OriginIdSchema.parse(id)
    const row = await get(this.db, `SELECT * FROM origins WHERE id = ?`, [originId])
    if (!row) return null
    return normalizeOriginRow(row)
  }

  async getAll() {
    const rows = await all(this.db, `SELECT * FROM origins`)
    return rows.map(normalizeOriginRow)
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
      `SELECT * FROM origins
       WHERE ${where.join(' AND ')}
       ORDER BY id DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    )

    return rows.map(normalizeOriginRow)
  }

  async updateById(id, data) {
    const originId = OriginIdSchema.parse(id)
    const payload = OriginUpdateSchema.parse(data)

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
    if (payload.is_active !== undefined) {
      fields.push('is_active = ?')
      params.push(payload.is_active ? 1 : 0)
    }
    if (payload.is_default !== undefined) {
      fields.push('is_default = ?')
      params.push(payload.is_default ? 1 : 0)
    }

    fields.push('updated_at = ?')
    params.push(new Date().toISOString())

    await run(
      this.db,
      `UPDATE origins SET ${fields.join(', ')} WHERE id = ?`,
      [...params, originId]
    )

    return await this.getById(originId)
  }

  async deleteById(id) {
    const originId = OriginIdSchema.parse(id)
    const now = new Date().toISOString()
    await run(
      this.db,
      `UPDATE origins SET deleted_at = ?, updated_at = ? WHERE id = ?`,
      [now, now, originId]
    )
    return true
  }
}

module.exports = { OriginSqliteDAL }

