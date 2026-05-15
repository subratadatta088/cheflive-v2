const { UtilizationModel } = require('../../../models/UtilizationModel')
const {
  UtilizationApiRowSchema,
  UtilizationCreateInternalSchema,
  UtilizationIdSchema,
  UtilizationRowSchema,
  UtilizationUpdateSchema,
} = require('../../../models/utilization/schema')
const { UtilizationItemApiRowSchema } = require('../../../models/utilizationItem/schema')
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

function normalizeUtilizationRow(row) {
  return UtilizationRowSchema.parse(row)
}

function normalizeUtilizationApiRow(row) {
  return UtilizationApiRowSchema.parse(row)
}

function normalizeUtilizationItemApiRow(row) {
  return UtilizationItemApiRowSchema.parse(row)
}

async function fetchUtilizationItemsJoined(db, organization_id, utilizationIds) {
  const ids = Array.isArray(utilizationIds)
    ? [...new Set(utilizationIds.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0))]
    : []
  if (!ids.length) return []
  const placeholders = ids.map(() => '?').join(', ')
  return await all(
    db,
    `SELECT ui.*, i.name AS ingredient_name
     FROM utilization_items ui
     LEFT JOIN ingredients i
       ON i.id = ui.ingredient_id
      AND i.organization_id = ui.organization_id
      AND (i.deleted_at IS NULL OR i.deleted_at = '')
     WHERE ui.organization_id = ?
       AND ui.utilization_id IN (${placeholders})
       AND (ui.deleted_at IS NULL OR ui.deleted_at = '')
     ORDER BY ui.utilization_id ASC, ui.id ASC`,
    [organization_id, ...ids]
  )
}

class UtilizationSqliteDAL extends UtilizationModel {
  constructor() {
    super()
    this.db = openSqlite()
  }

  async create(data) {
    const payload = UtilizationCreateInternalSchema.parse(data)
    const now = new Date().toISOString()
    const item_created_by = payload.created_by ?? null

    return await withTransaction(this.db, async () => {
      const originRow = await get(
        this.db,
        `SELECT organization_id FROM origins WHERE id = ? AND (deleted_at IS NULL OR deleted_at = '')`,
        [payload.origin_id]
      )
      if (!originRow) throw new Error('Origin not found')
      if (Number(originRow.organization_id) !== payload.organization_id)
        throw new Error('Origin organization mismatch')

      if (payload.preparation_id) {
        const prepRow = await get(
          this.db,
          `SELECT organization_id FROM preparations WHERE id = ? AND (deleted_at IS NULL OR deleted_at = '')`,
          [payload.preparation_id]
        )
        if (!prepRow) throw new Error('Preparation not found')
        if (Number(prepRow.organization_id) !== payload.organization_id)
          throw new Error('Preparation organization mismatch')
      }

      if (Array.isArray(payload.items) && payload.items.length) {
        const ingredientIds = [...new Set(payload.items.map((i) => i.ingredient_id))]
        const placeholders = ingredientIds.map(() => '?').join(', ')
        const checkRow = await get(
          this.db,
          `SELECT COUNT(*) AS c FROM ingredients
           WHERE organization_id = ?
             AND id IN (${placeholders})
             AND (deleted_at IS NULL OR deleted_at = '')`,
          [payload.organization_id, ...ingredientIds]
        )
        if (Number(checkRow?.c || 0) !== ingredientIds.length)
          throw new Error('Ingredient organization mismatch')
      }

      const result = await run(
        this.db,
        `INSERT INTO utilizations (
           organization_id,
           origin_id,
           preparation_id,
           type,
           qty,
           unit,
           date,
           note,
           created_by,
           created_at,
           updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          payload.organization_id,
          payload.origin_id,
          payload.preparation_id ?? null,
          payload.type ?? (payload.preparation_id ? 'preparation' : null),
          payload.qty ?? null,
          payload.unit ?? null,
          payload.date,
          payload.note ?? null,
          item_created_by,
          now,
          now,
        ]
      )

      const utilizationId = result.lastID

      if (Array.isArray(payload.items) && payload.items.length) {
        for (const it of payload.items) {
          await run(
            this.db,
            `INSERT INTO utilization_items (
               organization_id,
               utilization_id,
               ingredient_id,
               qty,
               unit,
               created_by,
               created_at,
               updated_at
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              payload.organization_id,
              utilizationId,
              it.ingredient_id,
              it.qty,
              it.unit,
              item_created_by,
              now,
              now,
            ]
          )
        }
      }

      return await this.getById(utilizationId)
    })
  }

  async getById(id) {
    const uid = UtilizationIdSchema.parse(id)
    const row = await get(
      this.db,
      `SELECT u.*, o.name AS origin_name, p.name AS preparation_name
       FROM utilizations u
       LEFT JOIN origins o
         ON o.id = u.origin_id
        AND o.organization_id = u.organization_id
        AND (o.deleted_at IS NULL OR o.deleted_at = '')
       LEFT JOIN preparations p
         ON p.id = u.preparation_id
        AND p.organization_id = u.organization_id
        AND (p.deleted_at IS NULL OR p.deleted_at = '')
       WHERE u.id = ?`,
      [uid]
    )
    if (!row) return null
    const utilization = normalizeUtilizationApiRow(row)

    const itemRows = await fetchUtilizationItemsJoined(this.db, utilization.organization_id, [
      utilization.id,
    ])

    return { ...utilization, items: itemRows.map(normalizeUtilizationItemApiRow) }
  }

  async list({ organization_id, page, limit, q, origin_id }) {
    const scopedWhere = [
      'u.organization_id = ?',
      `(u.deleted_at IS NULL OR u.deleted_at = '')`,
    ]
    const scopedParams = [organization_id]

    if (q) {
      scopedWhere.push('u.note LIKE ?')
      scopedParams.push(`%${q}%`)
    }

    if (origin_id) {
      scopedWhere.push('u.origin_id = ?')
      scopedParams.push(origin_id)
    }

    const offset = (page - 1) * limit

    const rows = await all(
      this.db,
      `SELECT u.*, o.name AS origin_name, p.name AS preparation_name
       FROM utilizations u
       LEFT JOIN origins o
         ON o.id = u.origin_id
        AND o.organization_id = u.organization_id
        AND (o.deleted_at IS NULL OR o.deleted_at = '')
       LEFT JOIN preparations p
         ON p.id = u.preparation_id
        AND p.organization_id = u.organization_id
        AND (p.deleted_at IS NULL OR p.deleted_at = '')
       WHERE ${scopedWhere.join(' AND ')}
       ORDER BY u.id DESC
       LIMIT ? OFFSET ?`,
      [...scopedParams, limit, offset]
    )

    const utilizations = rows.map(normalizeUtilizationApiRow)
    if (!utilizations.length) return utilizations.map((u) => ({ ...u, items: [] }))

    const utilizationIds = utilizations.map((u) => u.id)

    const itemRows = await fetchUtilizationItemsJoined(this.db, organization_id, utilizationIds)

    const items = itemRows.map(normalizeUtilizationItemApiRow)
    const byUtilization = new Map()
    for (const it of items) {
      const uid = it.utilization_id
      if (!uid) continue
      const arr = byUtilization.get(uid) || []
      arr.push(it)
      byUtilization.set(uid, arr)
    }

    return utilizations.map((u) => ({ ...u, items: byUtilization.get(u.id) || [] }))
  }

  async updateById(id, data) {
    const uid = UtilizationIdSchema.parse(id)
    const payload = UtilizationUpdateSchema.parse(data)

    const existing = await get(this.db, `SELECT * FROM utilizations WHERE id = ?`, [uid])
    if (!existing) return null

    if (payload.origin_id !== undefined) {
      const originRow = await get(
        this.db,
        `SELECT organization_id FROM origins WHERE id = ? AND (deleted_at IS NULL OR deleted_at = '')`,
        [payload.origin_id]
      )
      if (!originRow) throw new Error('Origin not found')
      if (Number(originRow.organization_id) !== Number(existing.organization_id))
        throw new Error('Origin organization mismatch')
    }

    if (payload.preparation_id !== undefined && payload.preparation_id !== null) {
      const prepRow = await get(
        this.db,
        `SELECT organization_id FROM preparations WHERE id = ? AND (deleted_at IS NULL OR deleted_at = '')`,
        [payload.preparation_id]
      )
      if (!prepRow) throw new Error('Preparation not found')
      if (Number(prepRow.organization_id) !== Number(existing.organization_id))
        throw new Error('Preparation organization mismatch')
    }

    const updatedAt = new Date().toISOString()

    const fields = []
    const params = []

    if (payload.origin_id !== undefined) {
      fields.push('origin_id = ?')
      params.push(payload.origin_id)
    }
    if (payload.preparation_id !== undefined) {
      fields.push('preparation_id = ?')
      params.push(payload.preparation_id)
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
    if (payload.date !== undefined) {
      fields.push('date = ?')
      params.push(payload.date)
    }
    if (payload.note !== undefined) {
      fields.push('note = ?')
      params.push(payload.note)
    }

    fields.push('updated_at = ?')
    params.push(updatedAt)

    await run(this.db, `UPDATE utilizations SET ${fields.join(', ')} WHERE id = ?`, [...params, uid])

    return await this.getById(uid)
  }

  async deleteById(id) {
    const uid = UtilizationIdSchema.parse(id)
    const now = new Date().toISOString()

    return await withTransaction(this.db, async () => {
      const existing = await get(this.db, `SELECT * FROM utilizations WHERE id = ?`, [uid])
      if (!existing) return false
      if (existing.deleted_at) return true

      await run(this.db, `UPDATE utilizations SET deleted_at = ?, updated_at = ? WHERE id = ?`, [
        now,
        now,
        uid,
      ])
      await run(
        this.db,
        `UPDATE utilization_items SET deleted_at = ?, updated_at = ? WHERE utilization_id = ?`,
        [now, now, uid]
      )
      return true
    })
  }

  /**
   * @param {{ organization_id: number, utilization_ids: number[] }} params
   */
  async groupItemsByIngredient({ organization_id, utilization_ids }) {
    const org = Number(organization_id)
    if (!Number.isFinite(org) || org <= 0) throw new Error('Invalid organization_id')

    const ids = Array.isArray(utilization_ids)
      ? [...new Set(utilization_ids.map((id) => Number(id)).filter((n) => Number.isFinite(n) && n > 0))]
      : []

    if (!ids.length) {
      return { utilization_ids: [], found_utilization_ids: [], missing_ids: [], items: [], subtotal: 0 }
    }

    const placeholders = ids.map(() => '?').join(', ')

    const utilizationRows = await all(
      this.db,
      `SELECT id
       FROM utilizations
       WHERE organization_id = ?
         AND id IN (${placeholders})
         AND (deleted_at IS NULL OR deleted_at = '')`,
      [org, ...ids]
    )
    const foundUtilizationIds = utilizationRows.map((r) => Number(r.id)).filter((n) => Number.isFinite(n))
    const missingIds = ids.filter((id) => !foundUtilizationIds.includes(id))

    if (!foundUtilizationIds.length) {
      return {
        utilization_ids: ids,
        found_utilization_ids: [],
        missing_ids: missingIds,
        items: [],
        subtotal: 0,
      }
    }

    const foundPlaceholders = foundUtilizationIds.map(() => '?').join(', ')

    const rows = await all(
      this.db,
      `SELECT ui.ingredient_id,
              ui.qty,
              ui.unit,
              i.name AS ingredient_name,
              i.unit AS default_unit
       FROM utilization_items ui
       LEFT JOIN ingredients i
         ON i.id = ui.ingredient_id
        AND i.organization_id = ui.organization_id
        AND (i.deleted_at IS NULL OR i.deleted_at = '')
       WHERE ui.organization_id = ?
         AND ui.utilization_id IN (${foundPlaceholders})
         AND (ui.deleted_at IS NULL OR ui.deleted_at = '')`,
      [org, ...foundUtilizationIds]
    )

    if (!rows.length) {
      return {
        utilization_ids: ids,
        found_utilization_ids: foundUtilizationIds,
        missing_ids: missingIds,
        items: [],
        subtotal: 0,
      }
    }

    const ingredientIds = [...new Set(rows.map((r) => Number(r.ingredient_id)).filter((n) => Number.isFinite(n) && n > 0))]
    let convRows = []
    if (ingredientIds.length) {
      const convPlaceholders = ingredientIds.map(() => '?').join(', ')
      convRows = await all(
        this.db,
        `SELECT ingredient_id, from_unit, to_unit, factor
         FROM ingredient_unit_conversions
         WHERE organization_id = ?
           AND ingredient_id IN (${convPlaceholders})
           AND (deleted_at IS NULL OR deleted_at = '')`,
        [org, ...ingredientIds]
      )
    }

    const convKey = (ingId, fromUnit, toUnit) => `${ingId}|${fromUnit}|${toUnit}`
    const convMap = new Map()
    for (const c of convRows) {
      const k = convKey(Number(c.ingredient_id), String(c.from_unit || '').trim(), String(c.to_unit || '').trim())
      const f = Number(c.factor)
      if (Number.isFinite(f) && f > 0) convMap.set(k, f)
    }

    const grouped = new Map()
    for (const r of rows) {
      const ingredient_id = Number(r.ingredient_id)
      if (!Number.isFinite(ingredient_id) || ingredient_id <= 0) continue

      const defaultUnit = String(r.default_unit || '').trim()
      if (!defaultUnit) continue

      const rawQty = Number(r.qty)
      if (!Number.isFinite(rawQty)) continue

      const fromUnit = r.unit ? String(r.unit).trim() : ''
      let factor = 1
      if (fromUnit && fromUnit !== defaultUnit) {
        const f = convMap.get(convKey(ingredient_id, fromUnit, defaultUnit))
        if (!f) {
          const err = new Error(
            `Unit conversion not found for ingredient ${ingredient_id}: ${fromUnit} -> ${defaultUnit}`
          )
          err.code = 'UNIT_CONVERSION_NOT_FOUND'
          throw err
        }
        factor = f
      }

      const qtyDefault = rawQty * factor

      let g = grouped.get(ingredient_id)
      if (!g) {
        g = { ingredient_id, ingredient_name: r.ingredient_name ?? null, unit: defaultUnit, qty: 0 }
        grouped.set(ingredient_id, g)
      }
      g.qty += qtyDefault
    }

    const items = []
    for (const g of grouped.values()) {
      items.push({
        ingredient_id: g.ingredient_id,
        ingredient_name: g.ingredient_name,
        qty: g.qty,
        unit: g.unit,
      })
    }

    items.sort((a, b) =>
      String(a.ingredient_name || '').localeCompare(String(b.ingredient_name || '')),
    )

    return {
      utilization_ids: ids,
      found_utilization_ids: foundUtilizationIds,
      missing_ids: missingIds,
      items,
      subtotal: 0,
    }
  }

  /**
   * @param {{ organization_id: number, utilization_ids: number[] }} params
   */
  async getAllItems({ organization_id, utilization_ids }) {
    const org = Number(organization_id)
    if (!Number.isFinite(org) || org <= 0) throw new Error('Invalid organization_id')

    const ids = Array.isArray(utilization_ids)
      ? [...new Set(utilization_ids.map((id) => Number(id)).filter((n) => Number.isFinite(n) && n > 0))]
      : []

    if (!ids.length) {
      return { utilization_ids: [], found_utilization_ids: [], missing_ids: [], items: [], subtotal: 0 }
    }

    const placeholders = ids.map(() => '?').join(', ')

    const utilizationRows = await all(
      this.db,
      `SELECT id
       FROM utilizations
       WHERE organization_id = ?
         AND id IN (${placeholders})
         AND (deleted_at IS NULL OR deleted_at = '')`,
      [org, ...ids]
    )
    const foundUtilizationIds = utilizationRows.map((r) => Number(r.id)).filter((n) => Number.isFinite(n))
    const missingIds = ids.filter((id) => !foundUtilizationIds.includes(id))

    if (!foundUtilizationIds.length) {
      return {
        utilization_ids: ids,
        found_utilization_ids: [],
        missing_ids: missingIds,
        items: [],
        subtotal: 0,
      }
    }

    const foundPlaceholders = foundUtilizationIds.map(() => '?').join(', ')
    const itemParams = [org, ...foundUtilizationIds]

    const rows = await all(
      this.db,
      `SELECT ui.id,
              ui.organization_id,
              ui.utilization_id,
              ui.ingredient_id,
              ui.qty,
              ui.unit,
              ui.created_by,
              ui.created_at,
              ui.updated_at,
              ui.deleted_at,
              i.name AS ingredient_name,
              i.unit AS ingredient_default_unit,
              i.item_code
       FROM utilization_items ui
       LEFT JOIN ingredients i
         ON i.id = ui.ingredient_id
        AND i.organization_id = ui.organization_id
        AND (i.deleted_at IS NULL OR i.deleted_at = '')
       WHERE ui.organization_id = ?
         AND ui.utilization_id IN (${foundPlaceholders})
         AND (ui.deleted_at IS NULL OR ui.deleted_at = '')
       ORDER BY ui.utilization_id ASC, ui.id ASC`,
      itemParams
    )

    const items = rows.map((r) => normalizeUtilizationItemApiRow(r))
    return {
      utilization_ids: ids,
      found_utilization_ids: foundUtilizationIds,
      missing_ids: missingIds,
      items,
      subtotal: 0,
    }
  }
}

module.exports = { UtilizationSqliteDAL }
