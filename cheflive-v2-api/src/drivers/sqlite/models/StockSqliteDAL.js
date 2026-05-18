const { StockModel } = require('../../../models/StockModel')
const { StockListItemSchema, StockListQuerySchema } = require('../../../models/stock/schema')
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

function normalizeItem(row, origins = []) {
  return StockListItemSchema.parse({
    ingredient_id: row.ingredient_id,
    ingredient_name: row.ingredient_name,
    item_code: row.item_code ?? null,
    unit: row.unit,
    category_id: row.category_id,
    category_name: row.category_name ?? null,
    current_qty: row.current_qty ?? 0,
    origins: origins.length ? origins : undefined,
  })
}

class StockSqliteDAL extends StockModel {
  constructor() {
    super()
    this.db = openSqlite()
  }

  /**
   * Ingredient-wise current stock (optionally filtered by origins and ingredients).
   * @param {Record<string, unknown>} query
   */
  async list(query) {
    const q = StockListQuerySchema.parse(query)
    if (!q.organization_id) throw new Error('organization_id is required')

    const baseWhere = [
      'i.organization_id = ?',
      "(i.deleted_at IS NULL OR i.deleted_at = '')",
      'i.is_active = 1',
    ]
    const baseParams = [q.organization_id]

    if (q.q) {
      const qStr = String(q.q ?? '').trim()
      const qLike = `%${qStr}%`
      baseWhere.push('(i.name LIKE ? OR CAST(i.item_code AS TEXT) LIKE ?)')
      baseParams.push(qLike, qLike)
    }

    if (Array.isArray(q.ingredient_ids) && q.ingredient_ids.length) {
      const unique = Array.from(new Set(q.ingredient_ids.map((n) => Number(n)).filter((n) => Number.isFinite(n))))
      if (unique.length) {
        const placeholders = unique.map(() => '?').join(', ')
        baseWhere.push(`i.id IN (${placeholders})`)
        baseParams.push(...unique)
      }
    }

    const rsJoinExtra = []
    const rsJoinParams = []
    if (Array.isArray(q.origin_ids) && q.origin_ids.length) {
      const unique = Array.from(new Set(q.origin_ids.map((n) => Number(n)).filter((n) => Number.isFinite(n))))
      if (unique.length) {
        const placeholders = unique.map(() => '?').join(', ')
        rsJoinExtra.push(`AND rs.origin_id IN (${placeholders})`)
        rsJoinParams.push(...unique)
      }
    }

    const whereSql = baseWhere.join(' AND ')
    const offset = (q.page - 1) * q.limit

    const countRow = await get(
      this.db,
      `SELECT COUNT(*) AS total
       FROM ingredients i
       WHERE ${whereSql}`,
      baseParams
    )
    const total = Number(countRow?.total) || 0

    const rows = await all(
      this.db,
      `SELECT
         i.id AS ingredient_id,
         i.name AS ingredient_name,
         i.item_code,
         i.unit,
         i.category_id,
         c.name AS category_name,
         COALESCE(SUM(rs.qty), 0) AS current_qty
       FROM ingredients i
       LEFT JOIN categories c ON c.id = i.category_id
       LEFT JOIN running_stock rs
         ON rs.ingredient_id = i.id
         AND rs.organization_id = i.organization_id
         AND (rs.deleted_at IS NULL OR rs.deleted_at = '')
         ${rsJoinExtra.join(' ')}
       WHERE ${whereSql}
       GROUP BY i.id
       ORDER BY i.name COLLATE NOCASE ASC
       LIMIT ? OFFSET ?`,
      [...rsJoinParams, ...baseParams, q.limit, offset]
    )

    const ingredientIds = rows.map((r) => Number(r.ingredient_id)).filter((n) => Number.isFinite(n) && n > 0)
    /** @type {Map<number, Array<{ origin_id: number, origin_name: string, qty: number, unit: string }>>} */
    const breakdownByIngredient = new Map()

    if (ingredientIds.length) {
      const idPlaceholders = ingredientIds.map(() => '?').join(', ')
      const breakdownWhere = [
        'rs.organization_id = ?',
        "(rs.deleted_at IS NULL OR rs.deleted_at = '')",
        `rs.ingredient_id IN (${idPlaceholders})`,
      ]
      const breakdownParams = [q.organization_id, ...ingredientIds]

      if (Array.isArray(q.origin_ids) && q.origin_ids.length) {
        const unique = Array.from(new Set(q.origin_ids.map((n) => Number(n)).filter((n) => Number.isFinite(n))))
        if (unique.length) {
          const placeholders = unique.map(() => '?').join(', ')
          breakdownWhere.push(`rs.origin_id IN (${placeholders})`)
          breakdownParams.push(...unique)
        }
      }

      const breakdownRows = await all(
        this.db,
        `SELECT
           rs.ingredient_id,
           rs.origin_id,
           o.name AS origin_name,
           rs.qty,
           rs.unit
         FROM running_stock rs
         INNER JOIN origins o ON o.id = rs.origin_id
         WHERE ${breakdownWhere.join(' AND ')}
           AND (o.deleted_at IS NULL OR o.deleted_at = '')
         ORDER BY o.name COLLATE NOCASE ASC`,
        breakdownParams
      )

      for (const br of breakdownRows) {
        const ingId = Number(br.ingredient_id)
        if (!Number.isFinite(ingId)) continue
        const list = breakdownByIngredient.get(ingId) || []
        list.push({
          origin_id: Number(br.origin_id),
          origin_name: String(br.origin_name || ''),
          qty: Number(br.qty) || 0,
          unit: String(br.unit || ''),
        })
        breakdownByIngredient.set(ingId, list)
      }
    }

    const items = rows.map((row) => {
      const ingId = Number(row.ingredient_id)
      const origins = breakdownByIngredient.get(ingId) || []
      return normalizeItem(row, origins)
    })

    return { items, total }
  }
}

module.exports = { StockSqliteDAL }
