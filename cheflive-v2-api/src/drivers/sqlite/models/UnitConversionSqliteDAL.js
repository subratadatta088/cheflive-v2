const { UnitConversionModel } = require('../../../models/UnitConversionModel')
const {
  UnitConversionCreateSchema,
  UnitConversionIdSchema,
  UnitConversionRowSchema,
  UnitConversionUpdateSchema,
} = require('../../../models/unitConversion/schema')
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

function normalizeRow(row) {
  return UnitConversionRowSchema.parse(row)
}

class UnitConversionSqliteDAL extends UnitConversionModel {
  constructor() {
    super()
    this.db = openSqlite()
  }

  async create(data) {
    const payload = UnitConversionCreateSchema.parse(data)
    const now = new Date().toISOString()

    const ingRow = await get(
      this.db,
      `SELECT organization_id FROM ingredients WHERE id = ?`,
      [payload.ingredient_id]
    )
    if (!ingRow) throw new Error('Ingredient not found')
    if (Number(ingRow.organization_id) !== payload.organization_id)
      throw new Error('Ingredient organization mismatch')

    const result = await run(
      this.db,
      `INSERT INTO ingredient_unit_conversions (organization_id, ingredient_id, from_unit, to_unit, factor, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        payload.organization_id,
        payload.ingredient_id,
        payload.from_unit,
        payload.to_unit,
        payload.factor,
        now,
        now,
      ]
    )

    return await this.getById(result.lastID)
  }

  async getById(id) {
    const conversionId = UnitConversionIdSchema.parse(id)
    const row = await get(this.db, `SELECT * FROM ingredient_unit_conversions WHERE id = ?`, [
      conversionId,
    ])
    if (!row) return null
    return normalizeRow(row)
  }

  async getAll() {
    const rows = await all(this.db, `SELECT * FROM ingredient_unit_conversions`)
    return rows.map(normalizeRow)
  }

  async list({ organization_id, ingredient_id, page, limit }) {
    const where = ['organization_id = ?']
    const params = [organization_id]

    if (ingredient_id) {
      where.push('ingredient_id = ?')
      params.push(ingredient_id)
    }

    const offset = (page - 1) * limit

    const rows = await all(
      this.db,
      `SELECT * FROM ingredient_unit_conversions
       WHERE ${where.join(' AND ')}
       ORDER BY id DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    )

    return rows.map(normalizeRow)
  }

  async updateById(id, data) {
    const conversionId = UnitConversionIdSchema.parse(id)
    const payload = UnitConversionUpdateSchema.parse(data)

    const fields = []
    const params = []

    if (payload.from_unit !== undefined) {
      fields.push('from_unit = ?')
      params.push(payload.from_unit)
    }
    if (payload.to_unit !== undefined) {
      fields.push('to_unit = ?')
      params.push(payload.to_unit)
    }
    if (payload.factor !== undefined) {
      fields.push('factor = ?')
      params.push(payload.factor)
    }

    fields.push('updated_at = ?')
    params.push(new Date().toISOString())

    await run(
      this.db,
      `UPDATE ingredient_unit_conversions SET ${fields.join(', ')} WHERE id = ?`,
      [...params, conversionId]
    )

    return await this.getById(conversionId)
  }

  async deleteById(id) {
    const conversionId = UnitConversionIdSchema.parse(id)
    const now = new Date().toISOString()
    await run(
      this.db,
      `UPDATE ingredient_unit_conversions SET deleted_at = ?, updated_at = ? WHERE id = ?`,
      [now, now, conversionId]
    )
    return true
  }
}

module.exports = { UnitConversionSqliteDAL }
