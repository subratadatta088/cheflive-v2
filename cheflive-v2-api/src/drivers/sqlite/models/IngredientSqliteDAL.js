const { IngredientModel } = require('../../../models/IngredientModel')
const {
  IngredientCreateSchema,
  IngredientIdSchema,
  IngredientRowSchema,
  IngredientUpdateSchema,
} = require('../../../models/ingredient/schema')
const { UnitConversionRowSchema } = require('../../../models/unitConversion/schema')
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

function normalizeIngredientRow(row) {
  const parsed = IngredientRowSchema.parse(row)

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

function normalizeUnitConversionRow(row) {
  return UnitConversionRowSchema.parse(row)
}

class IngredientSqliteDAL extends IngredientModel {
  constructor() {
    super()
    this.db = openSqlite()
  }

  async create(data) {
    const payload = IngredientCreateSchema.parse(data)
    const now = new Date().toISOString()

    const tagsJson = payload.tags ? JSON.stringify(payload.tags) : null
    const isActiveInt =
      payload.is_active === undefined ? 1 : payload.is_active ? 1 : 0

    const result = await run(
      this.db,
      `INSERT INTO ingredients (organization_id, name, unit, base_price, tags, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        payload.organization_id,
        payload.name,
        payload.unit,
        payload.base_price ?? null,
        tagsJson,
        isActiveInt,
        now,
        now,
      ]
    )

    return await this.getById(result.lastID)
  }

  async getById(id) {
    const ingredientId = IngredientIdSchema.parse(id)
    const row = await get(this.db, `SELECT * FROM ingredients WHERE id = ?`, [ingredientId])
    if (!row) return null
    const ing = normalizeIngredientRow(row)
    const convRows = await all(
      this.db,
      `SELECT *
       FROM ingredient_unit_conversions
       WHERE organization_id = ?
         AND ingredient_id = ?
         AND (deleted_at IS NULL OR deleted_at = '')`,
      [ing.organization_id, ing.id]
    )
    return { ...ing, unit_conversions: convRows.map(normalizeUnitConversionRow) }
  }

  async getAll() {
    const rows = await all(this.db, `SELECT * FROM ingredients`)
    return rows.map(normalizeIngredientRow)
  }

  async list({ organization_id, page, limit, q, is_active }) {
    const where = ['organization_id = ?']
    const params = [organization_id]

    if (q) {
      where.push('name LIKE ?')
      params.push(`%${q}%`)
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
      `SELECT * FROM ingredients
       WHERE ${where.join(' AND ')}
       ORDER BY id DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    )

    const ingredients = rows.map(normalizeIngredientRow)
    if (!ingredients.length) return ingredients

    const ingredientIds = ingredients.map((i) => i.id)
    const placeholders = ingredientIds.map(() => '?').join(', ')

    const convRows = await all(
      this.db,
      `SELECT *
       FROM ingredient_unit_conversions
       WHERE organization_id = ?
         AND ingredient_id IN (${placeholders})
         AND (deleted_at IS NULL OR deleted_at = '')`,
      [organization_id, ...ingredientIds]
    )

    const convs = convRows.map(normalizeUnitConversionRow)
    const byIng = new Map()
    for (const c of convs) {
      const iid = c.ingredient_id
      if (!iid) continue
      const arr = byIng.get(iid) || []
      arr.push(c)
      byIng.set(iid, arr)
    }

    return ingredients.map((i) => ({
      ...i,
      unit_conversions: byIng.get(i.id) || [],
    }))
  }

  async updateById(id, data) {
    const ingredientId = IngredientIdSchema.parse(id)
    const payload = IngredientUpdateSchema.parse(data)

    const fields = []
    const params = []

    if (payload.name !== undefined) {
      fields.push('name = ?')
      params.push(payload.name)
    }
    if (payload.unit !== undefined) {
      fields.push('unit = ?')
      params.push(payload.unit)
    }
    if (payload.base_price !== undefined) {
      fields.push('base_price = ?')
      params.push(payload.base_price)
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
      `UPDATE ingredients SET ${fields.join(', ')} WHERE id = ?`,
      [...params, ingredientId]
    )

    return await this.getById(ingredientId)
  }

  async deleteById(id) {
    const ingredientId = IngredientIdSchema.parse(id)
    const now = new Date().toISOString()
    await run(
      this.db,
      `UPDATE ingredients SET deleted_at = ?, updated_at = ? WHERE id = ?`,
      [now, now, ingredientId]
    )
    return true
  }
}

module.exports = { IngredientSqliteDAL }

