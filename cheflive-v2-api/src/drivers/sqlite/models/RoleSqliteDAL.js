const { z } = require('zod')
const { RoleModel } = require('../../../models/RoleModel')
const { openSqlite } = require('../db')

function all(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err)
      resolve(rows)
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

function run(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err)
      resolve({ lastID: this.lastID, changes: this.changes })
    })
  })
}

const RoleNameSchema = z.enum(['superadmin', 'admin', 'member'])

class RoleSqliteDAL extends RoleModel {
  constructor() {
    super()
    this.db = openSqlite()
  }

  async getRoleNamesForUser({ user_id, organization_id }) {
    const rows = await all(
      this.db,
      `SELECT r.name AS name
       FROM user_roles ur
       JOIN roles r ON r.id = ur.role_id
       WHERE ur.user_id = ? AND (ur.organization_id = ? OR (ur.organization_id IS NULL AND ? IS NULL))`,
      [user_id, organization_id ?? null, organization_id ?? null]
    )
    return rows.map((r) => RoleNameSchema.parse(r.name))
  }

  async assignRoleToUser({ user_id, organization_id, role_name }) {
    const roleName = RoleNameSchema.parse(role_name)
    const roleRow = await get(this.db, `SELECT id FROM roles WHERE name = ?`, [roleName])
    if (!roleRow?.id) throw new Error(`Role not found: ${roleName}`)

    const now = new Date().toISOString()
    await run(
      this.db,
      `INSERT OR IGNORE INTO user_roles (organization_id, user_id, role_id, created_at)
       VALUES (?, ?, ?, ?)`,
      [organization_id ?? null, user_id, roleRow.id, now]
    )
    return true
  }
}

module.exports = { RoleSqliteDAL }
