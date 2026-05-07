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

function exec(db, sql) {
  return new Promise((resolve, reject) => {
    db.exec(sql, (err) => {
      if (err) return reject(err)
      resolve(true)
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

  async listNamesByOrganization(organization_id) {
    const rows = await all(
      this.db,
      `SELECT name
       FROM ingredients
       WHERE organization_id = ?
         AND (deleted_at IS NULL OR deleted_at = '')`,
      [organization_id],
    )
    return rows.map((r) => String(r?.name ?? '')).filter(Boolean)
  }

  async create(data) {
    const payload = IngredientCreateSchema.parse(data)
    const now = new Date().toISOString()

    const tagsJson = payload.tags ? JSON.stringify(payload.tags) : null
    const isActiveInt =
      payload.is_active === undefined ? 1 : payload.is_active ? 1 : 0

    const result = await run(
      this.db,
      `INSERT INTO ingredients (organization_id, category_id, item_code, name, unit, base_price, tags, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        payload.organization_id,
        payload.category_id,
        payload.item_code ?? null,
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

  /**
   * Transaction-based bulk insert with per-row savepoints so failures don't rollback the whole batch.
   * @param {Array<import('../../../models/ingredient/schema').IngredientCreateSchema>} items
   * @returns {Promise<{ created: number, failures: { name: string|null, error: string }[] }>}
   */
  async bulkCreate(items) {
    const inputs = Array.isArray(items) ? items : []
    if (!inputs.length) return { created: 0, failures: [] }

    let created = 0
    /** @type {{ name: string|null, error: string }[]} */
    const failures = []

    await exec(this.db, 'BEGIN')
    try {
      for (let i = 0; i < inputs.length; i++) {
        const raw = inputs[i]
        let payload
        try {
          payload = IngredientCreateSchema.parse(raw)
        } catch (e) {
          failures.push({ name: String(raw?.name ?? '').trim() || null, error: 'Invalid payload' })
          continue
        }

        const sp = `sp_ing_${i}`
        await exec(this.db, `SAVEPOINT ${sp}`)
        try {
          const now = new Date().toISOString()
          const tagsJson = payload.tags ? JSON.stringify(payload.tags) : null
          const isActiveInt = payload.is_active === undefined ? 1 : payload.is_active ? 1 : 0

          await run(
            this.db,
            `INSERT INTO ingredients (organization_id, category_id, item_code, name, unit, base_price, tags, is_active, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              payload.organization_id,
              payload.category_id,
              payload.item_code ?? null,
              payload.name,
              payload.unit,
              payload.base_price ?? null,
              tagsJson,
              isActiveInt,
              now,
              now,
            ],
          )

          await exec(this.db, `RELEASE ${sp}`)
          created++
        } catch (e) {
          // rollback only this row
          try {
            await exec(this.db, `ROLLBACK TO ${sp}`)
            await exec(this.db, `RELEASE ${sp}`)
          } catch {
            // ignore
          }
          failures.push({
            name: String(payload?.name ?? '').trim() || null,
            error: String(e?.message || 'Insert failed'),
          })
        }
      }

      await exec(this.db, 'COMMIT')
      return { created, failures }
    } catch (e) {
      try {
        await exec(this.db, 'ROLLBACK')
      } catch {
        // ignore
      }
      throw e
    }
  }

  /**
   * Transaction-based bulk update with per-row savepoints so failures don't rollback the whole batch.
   * @param {Array<{ id: number, name?: string|null, data: unknown }>} items
   * @returns {Promise<{ updated: number, failures: { id: number|null, name: string|null, error: string }[] }>}
   */
  async bulkUpdate(items) {
    const inputs = Array.isArray(items) ? items : []
    if (!inputs.length) return { updated: 0, failures: [] }

    let updated = 0
    /** @type {{ id: number|null, name: string|null, error: string }[]} */
    const failures = []

    await exec(this.db, 'BEGIN')
    try {
      for (let i = 0; i < inputs.length; i++) {
        const raw = inputs[i] || {}
        const id = Number(raw?.id)
        if (!Number.isFinite(id)) {
          failures.push({ id: null, name: String(raw?.name ?? '').trim() || null, error: 'Invalid id' })
          continue
        }

        const sp = `sp_ing_up_${i}`
        await exec(this.db, `SAVEPOINT ${sp}`)
        try {
          await this.updateById(id, raw?.data ?? {})
          await exec(this.db, `RELEASE ${sp}`)
          updated++
        } catch (e) {
          try {
            await exec(this.db, `ROLLBACK TO ${sp}`)
            await exec(this.db, `RELEASE ${sp}`)
          } catch {
            // ignore
          }
          failures.push({
            id,
            name: String(raw?.name ?? '').trim() || null,
            error: String(e?.message || 'Update failed'),
          })
        }
      }

      await exec(this.db, 'COMMIT')
      return { updated, failures }
    } catch (e) {
      try {
        await exec(this.db, 'ROLLBACK')
      } catch {
        // ignore
      }
      throw e
    }
  }

  async getById(id) {
    const ingredientId = IngredientIdSchema.parse(id)
    const row = await get(
      this.db,
      `SELECT i.*, c.name AS category_name
       FROM ingredients i
       LEFT JOIN categories c
         ON c.id = i.category_id
        AND c.organization_id = i.organization_id
       WHERE i.id = ?`,
      [ingredientId],
    )
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

  async list({ organization_id, page, limit, q, is_active, category_ids, ids }) {
    const offset = (page - 1) * limit

    const baseWhere = [
      'i.organization_id = ?',
      "(i.deleted_at IS NULL OR i.deleted_at = '')",
    ]
    const baseParams = [organization_id]

    if (q) {
      const qStr = String(q ?? '').trim()
      const qLike = `%${qStr}%`
      // Match by name OR item_code (barcode)
      baseWhere.push('(i.name LIKE ? OR CAST(i.item_code AS TEXT) LIKE ?)')
      baseParams.push(qLike, qLike)
    }

    if (Array.isArray(category_ids) && category_ids.length) {
      const unique = Array.from(new Set(category_ids.map((n) => Number(n)).filter((n) => Number.isFinite(n))))
      if (unique.length) {
        const placeholders = unique.map(() => '?').join(', ')
        baseWhere.push(`i.category_id IN (${placeholders})`)
        baseParams.push(...unique)
      }
    }

    if (Array.isArray(ids) && ids.length) {
      const unique = Array.from(new Set(ids.map((n) => Number(n)).filter((n) => Number.isFinite(n))))
      if (unique.length) {
        const placeholders = unique.map(() => '?').join(', ')
        baseWhere.push(`i.id IN (${placeholders})`)
        baseParams.push(...unique)
      }
    }

    if (is_active !== undefined) {
      const v = is_active === true || is_active === '1' || is_active === 1 ? 1 : 0
      baseWhere.push('i.is_active = ?')
      baseParams.push(v)
    }

    const whereSql = baseWhere.length ? `WHERE ${baseWhere.join(' AND ')}` : ''

    const countRow = await get(
      this.db,
      `SELECT COUNT(1) AS total
       FROM ingredients i
       ${whereSql}`,
      baseParams,
    )

    const total = Number(countRow?.total || 0)

    const rows = await all(
      this.db,
      `SELECT i.*, c.name AS category_name
       FROM ingredients i
       LEFT JOIN categories c
         ON c.id = i.category_id
        AND c.organization_id = i.organization_id
       ${whereSql}
       ORDER BY i.id DESC
       LIMIT ? OFFSET ?`,
      [...baseParams, limit, offset],
    )

    const ingredients = rows.map(normalizeIngredientRow)
    if (!ingredients.length) return { items: [], total }

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

    const items = ingredients.map((i) => ({
      ...i,
      unit_conversions: byIng.get(i.id) || [],
    }))

    return { items, total }
  }

  async updateById(id, data) {
    const ingredientId = IngredientIdSchema.parse(id)
    const payload = IngredientUpdateSchema.parse(data)

    const fields = []
    const params = []

    if (payload.item_code !== undefined) {
      fields.push('item_code = ?')
      params.push(payload.item_code)
    }
    if (payload.category_id !== undefined) {
      fields.push('category_id = ?')
      params.push(payload.category_id)
    }
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

  async getByItemCode({ organization_id, item_code }) {
    const orgId = Number(organization_id)
    const code = Number(item_code)
    if (!Number.isFinite(orgId) || !Number.isFinite(code)) return null

    const row = await get(
      this.db,
      `SELECT id
       FROM ingredients
       WHERE organization_id = ?
         AND item_code = ?
         AND (deleted_at IS NULL OR deleted_at = '')`,
      [orgId, code],
    )
    if (!row?.id) return null
    return await this.getById(row.id)
  }
}

module.exports = { IngredientSqliteDAL }

