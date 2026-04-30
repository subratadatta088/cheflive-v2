const { UserModel } = require('../../../models/UserModel')
const {
  UserCreateSchema,
  UserIdSchema,
  UserRowSchema,
  UserUpdateSchema,
} = require('../../../models/user/schema')
const { openSqlite } = require('../db')
const { hashPassword } = require('../../../utils/password')

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

class UserSqliteDAL extends UserModel {
  constructor() {
    super()
    this.db = openSqlite()
  }

  async getLoginPayloadByUsername(username) {
    const row = await get(
      this.db,
      `
SELECT
  u.id AS user_id,
  u.organization_id AS user_organization_id,
  u.username AS user_username,
  u.password AS user_password,
  u.name AS user_name,
  u.created_at AS user_created_at,
  u.updated_at AS user_updated_at,
  o.id AS org_id,
  o.name AS org_name,
  GROUP_CONCAT(r.name) AS roles_csv
FROM users u
LEFT JOIN organizations o ON o.id = u.organization_id
LEFT JOIN user_roles ur
  ON ur.user_id = u.id
 AND (
   ur.organization_id = u.organization_id
   OR (ur.organization_id IS NULL AND u.organization_id IS NULL)
 )
LEFT JOIN roles r ON r.id = ur.role_id
WHERE u.username = ?
GROUP BY u.id
      `,
      [username]
    )

    if (!row) return null

    const roles = String(row.roles_csv || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)

    return {
      user: {
        id: row.user_id,
        organization_id: row.user_organization_id ?? null,
        username: row.user_username,
        password: row.user_password,
        name: row.user_name ?? null,
        created_at: row.user_created_at ?? null,
        updated_at: row.user_updated_at ?? null,
      },
      organization: row.org_id
        ? {
            id: row.org_id,
            name: row.org_name,
          }
        : null,
      roles,
    }
  }

  async create(data) {
    const payload = UserCreateSchema.parse(data)

    const now = new Date().toISOString()
    const passwordHash = await hashPassword(payload.password)
    const result = await run(
      this.db,
      `INSERT INTO users (organization_id, username, password, name, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        payload.organization_id,
        payload.username,
        passwordHash,
        payload.name ?? null,
        now,
        now,
      ]
    )

    return await this.getById(result.lastID)
  }

  async getById(id) {
    const userId = UserIdSchema.parse(id)
    const row = await get(this.db, `SELECT * FROM users WHERE id = ?`, [userId])
    if (!row) return null
    return UserRowSchema.parse(row)
  }

  async getAll() {
    const rows = await all(this.db, `SELECT * FROM users`)
    return rows.map((r) => UserRowSchema.parse(r))
  }

  async updateById(id, data) {
    const userId = UserIdSchema.parse(id)
    const payload = UserUpdateSchema.parse(data)

    const fields = []
    const params = []

    if (payload.organization_id !== undefined) {
      fields.push('organization_id = ?')
      params.push(payload.organization_id)
    }
    if (payload.username !== undefined) {
      fields.push('username = ?')
      params.push(payload.username)
    }
    if (payload.password !== undefined) {
      fields.push('password = ?')
      params.push(await hashPassword(payload.password))
    }
    if (payload.name !== undefined) {
      fields.push('name = ?')
      params.push(payload.name)
    }

    fields.push('updated_at = ?')
    params.push(new Date().toISOString())

    await run(
      this.db,
      `UPDATE users SET ${fields.join(', ')} WHERE id = ?`,
      [...params, userId]
    )

    return await this.getById(userId)
  }

  async deleteById(id) {
    const userId = UserIdSchema.parse(id)
    const now = new Date().toISOString()
    await run(
      this.db,
      `UPDATE users SET deleted_at = ?, updated_at = ? WHERE id = ?`,
      [now, now, userId]
    )
    return true
  }
}

module.exports = { UserSqliteDAL }
