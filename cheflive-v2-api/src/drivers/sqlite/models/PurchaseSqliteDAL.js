const { PurchaseModel } = require('../../../models/PurchaseModel')
const {
  PurchaseApiRowSchema,
  PurchaseCreateInternalSchema,
  PurchaseIdSchema,
  PurchaseRowSchema,
  PurchaseUpdateSchema,
} = require('../../../models/purchase/schema')
const { PurchaseItemApiRowSchema, PurchaseItemRowSchema } = require('../../../models/purchaseItem/schema')
const { openSqlite } = require('../db')
const { applyStockMovement } = require('../stock/applyStockMovement')

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

function normalizePurchaseRow(row) {
  return PurchaseRowSchema.parse(row)
}

function normalizePurchaseApiRow(row) {
  return PurchaseApiRowSchema.parse(row)
}

function normalizeItemRow(row) {
  return PurchaseItemRowSchema.parse(row)
}

function normalizePurchaseItemApiRow(row) {
  return PurchaseItemApiRowSchema.parse(row)
}

/** Single query: purchase_items ⨝ ingredients for one or many purchases. */
async function fetchPurchaseItemsJoined(db, organization_id, purchaseIds) {
  const ids = Array.isArray(purchaseIds)
    ? [...new Set(purchaseIds.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0))]
    : []
  if (!ids.length) return []
  const placeholders = ids.map(() => '?').join(', ')
  return await all(
    db,
    `SELECT pi.*, i.name AS ingredient_name
     FROM purchase_items pi
     LEFT JOIN ingredients i
       ON i.id = pi.ingredient_id
      AND i.organization_id = pi.organization_id
      AND (i.deleted_at IS NULL OR i.deleted_at = '')
     WHERE pi.organization_id = ?
       AND pi.purchase_id IN (${placeholders})
       AND (pi.deleted_at IS NULL OR pi.deleted_at = '')
     ORDER BY pi.purchase_id ASC, pi.id ASC`,
    [organization_id, ...ids]
  )
}

/** Σ(qty × unit_price) over purchase line items (lines without unit_price contribute 0). */
function subtotalFromPurchaseItems(items) {
  const list = Array.isArray(items) ? items : []
  let subtotal = 0
  for (const it of list) {
    const q = Number(it.qty)
    const rawPrice = it.unit_price
    const price =
      rawPrice === null || rawPrice === undefined || rawPrice === '' ? NaN : Number(rawPrice)
    if (Number.isFinite(q) && Number.isFinite(price)) subtotal += q * price
  }
  return subtotal
}

class PurchaseSqliteDAL extends PurchaseModel {
  constructor() {
    super()
    this.db = openSqlite()
  }

  async create(data) {
    const payload = PurchaseCreateInternalSchema.parse(data)
    const now = new Date().toISOString()
    const created_by = payload.created_by ?? null

    return await withTransaction(this.db, async () => {
      const originRow = await get(
        this.db,
        `SELECT organization_id FROM origins WHERE id = ? AND (deleted_at IS NULL OR deleted_at = '')`,
        [payload.origin_id]
      )
      if (!originRow) throw new Error('Origin not found')
      if (Number(originRow.organization_id) !== payload.organization_id)
        throw new Error('Origin organization mismatch')

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
        `INSERT INTO purchases (organization_id, origin_id, date, note, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          payload.organization_id,
          payload.origin_id,
          payload.date,
          payload.note ?? null,
          created_by,
          now,
          now,
        ]
      )

      const purchaseId = result.lastID

      if (Array.isArray(payload.items) && payload.items.length) {
        for (const it of payload.items) {
          await run(
            this.db,
            `INSERT INTO purchase_items (organization_id, purchase_id, ingredient_id, qty, unit, unit_price, created_by, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              payload.organization_id,
              purchaseId,
              it.ingredient_id,
              it.qty,
              it.unit ?? null,
              it.unit_price ?? null,
              created_by,
              now,
              now,
            ]
          )
        }
      }

      return await this.getById(purchaseId)
    })
  }

  async getById(id) {
    const pid = PurchaseIdSchema.parse(id)
    const row = await get(
      this.db,
      `SELECT p.*, o.name AS origin_name, o.type AS origin_type
       FROM purchases p
       LEFT JOIN origins o
         ON o.id = p.origin_id
        AND o.organization_id = p.organization_id
        AND (o.deleted_at IS NULL OR o.deleted_at = '')
       WHERE p.id = ?`,
      [pid]
    )
    if (!row) return null
    const purchase = normalizePurchaseApiRow(row)

    const itemRows = await fetchPurchaseItemsJoined(this.db, purchase.organization_id, [purchase.id])

    const items = itemRows.map(normalizePurchaseItemApiRow)
    const subtotal = subtotalFromPurchaseItems(items)

    return {
      ...purchase,
      subtotal,
      items,
    }
  }

  async getAll() {
    const rows = await all(this.db, `SELECT * FROM purchases`)
    return rows.map(normalizePurchaseRow)
  }

  async list({ organization_id, page, limit, q, origin_id }) {
    const scopedWhere = [
      'p.organization_id = ?',
      '(p.deleted_at IS NULL OR p.deleted_at = \'\')',
    ]
    const scopedParams = [organization_id]

    if (q) {
      scopedWhere.push('p.note LIKE ?')
      scopedParams.push(`%${q}%`)
    }

    if (origin_id) {
      scopedWhere.push('p.origin_id = ?')
      scopedParams.push(origin_id)
    }

    const offset = (page - 1) * limit

    const rows = await all(
      this.db,
      `SELECT p.*, o.name AS origin_name, o.type AS origin_type
       FROM purchases p
       LEFT JOIN origins o
         ON o.id = p.origin_id
        AND o.organization_id = p.organization_id
        AND (o.deleted_at IS NULL OR o.deleted_at = '')
       WHERE ${scopedWhere.join(' AND ')}
       ORDER BY p.id DESC
       LIMIT ? OFFSET ?`,
      [...scopedParams, limit, offset]
    )

    const purchases = rows.map(normalizePurchaseApiRow)
    if (!purchases.length) return purchases.map((p) => ({ ...p, items: [] }))

    const purchaseIds = purchases.map((p) => p.id)

    const itemRows = await fetchPurchaseItemsJoined(this.db, organization_id, purchaseIds)

    const items = itemRows.map(normalizePurchaseItemApiRow)
    const byPurchase = new Map()
    for (const it of items) {
      const pid = it.purchase_id
      if (!pid) continue
      const arr = byPurchase.get(pid) || []
      arr.push(it)
      byPurchase.set(pid, arr)
    }

    return purchases.map((p) => {
      const items = byPurchase.get(p.id) || []
      const subtotal = subtotalFromPurchaseItems(items)
      return {
        ...p,
        subtotal,
        items,
      }
    })
  }

  async updateById(id, data) {
    const pid = PurchaseIdSchema.parse(id)
    const payload = PurchaseUpdateSchema.parse(data)

    const existing = await get(this.db, `SELECT * FROM purchases WHERE id = ?`, [pid])
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

    const fields = []
    const params = []

    if (payload.origin_id !== undefined) {
      fields.push('origin_id = ?')
      params.push(payload.origin_id)
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
    params.push(new Date().toISOString())

    await run(this.db, `UPDATE purchases SET ${fields.join(', ')} WHERE id = ?`, [...params, pid])

    return await this.getById(pid)
  }

  async deleteById(id) {
    const pid = PurchaseIdSchema.parse(id)
    const now = new Date().toISOString()
    await run(
      this.db,
      `UPDATE purchases SET deleted_at = ?, updated_at = ? WHERE id = ?`,
      [now, now, pid]
    )
    await run(
      this.db,
      `UPDATE purchase_items SET deleted_at = ?, updated_at = ? WHERE purchase_id = ?`,
      [now, now, pid]
    )
    return true
  }

  /**
   * Business operation: purchase created -> ledger + stock update + snapshot.
   * For now:
   * - Apply purchase_items qty into running_stock at purchases.origin_id
   * - Write stock_transition_states rows (source_type = purchase_in)
   * Note: purchase_items.unit is TEXT. If present and differs from ingredient.unit,
   * we use ingredient_unit_conversions (from_unit -> to_unit = ingredient.unit).
   */
  async processPurchaseCreated(purchaseId, meta = {}) {
    const pid = PurchaseIdSchema.parse(purchaseId)

    return await withTransaction(this.db, async () => {
      const purchase = await this.getById(pid)
      if (!purchase) throw new Error('Purchase not found')
      if (purchase.deleted_at) return true

      const occurred_at = meta?.occurred_at || purchase.date || new Date().toISOString()
      const created_by = meta?.actor_user_id ?? null

      const origin_id = Number(purchase.origin_id)
      const org_id = Number(purchase.organization_id)

      const items = Array.isArray(purchase.items) ? purchase.items : []
      for (const it of items) {
        const ingredient_id = Number(it.ingredient_id)
        const qty = Number(it.qty)
        if (!Number.isFinite(qty)) continue

        const ingRow = await get(
          this.db,
          `SELECT unit FROM ingredients WHERE id = ? AND organization_id = ? AND (deleted_at IS NULL OR deleted_at = '')`,
          [ingredient_id, org_id]
        )
        if (!ingRow) throw new Error('Ingredient not found')
        const default_unit = String(ingRow.unit || '').trim()
        if (!default_unit) throw new Error('Ingredient default unit is missing')

        let qty_default = qty
        const fromUnit = it.unit ? String(it.unit).trim() : ''
        if (fromUnit && fromUnit !== default_unit) {
          const conv = await get(
            this.db,
            `SELECT factor FROM ingredient_unit_conversions
             WHERE organization_id = ?
               AND ingredient_id = ?
               AND from_unit = ?
               AND to_unit = ?
               AND (deleted_at IS NULL OR deleted_at = '')`,
            [org_id, ingredient_id, fromUnit, default_unit]
          )
          if (!conv) throw new Error('Unit conversion not found')
          const factor = Number(conv.factor)
          if (!Number.isFinite(factor) || factor <= 0) throw new Error('Unit conversion factor invalid')
          qty_default = qty * factor
        }

        await applyStockMovement(this.db, {
          organization_id: org_id,
          origin_id,
          ingredient_id,
          qty_delta: +qty_default,
          unit: default_unit,
          source_type: 'purchase_in',
          source_purchase_id: pid,
          source_purchase_item_id: Number(it.id) || null,
          occurred_at,
          created_by,
        })
      }

      return true
    })
  }

  async processPurchaseUpdated(purchaseId, meta = {}) {
    const pid = PurchaseIdSchema.parse(purchaseId)
    const prev = meta?.previous
    const next = meta?.next
    if (!prev || !next) return await this.processPurchaseCreated(pid, meta)

    return await withTransaction(this.db, async () => {
      // reverse old
      const occurred_at = meta?.occurred_at || next?.date || new Date().toISOString()
      const created_by = meta?.actor_user_id ?? null

      const org_id = Number(next.organization_id)

      const items = Array.isArray(prev.items) ? prev.items : []
      for (const it of items) {
        const ingredient_id = Number(it.ingredient_id)
        const qty = Number(it.qty)
        if (!Number.isFinite(qty)) continue

        const ingRow = await get(
          this.db,
          `SELECT unit FROM ingredients WHERE id = ? AND organization_id = ? AND (deleted_at IS NULL OR deleted_at = '')`,
          [ingredient_id, org_id]
        )
        if (!ingRow) throw new Error('Ingredient not found')
        const default_unit = String(ingRow.unit || '').trim()
        if (!default_unit) throw new Error('Ingredient default unit is missing')

        let qty_default = qty
        const fromUnit = it.unit ? String(it.unit).trim() : ''
        if (fromUnit && fromUnit !== default_unit) {
          const conv = await get(
            this.db,
            `SELECT factor FROM ingredient_unit_conversions
             WHERE organization_id = ?
               AND ingredient_id = ?
               AND from_unit = ?
               AND to_unit = ?
               AND (deleted_at IS NULL OR deleted_at = '')`,
            [org_id, ingredient_id, fromUnit, default_unit]
          )
          if (!conv) throw new Error('Unit conversion not found')
          const factor = Number(conv.factor)
          if (!Number.isFinite(factor) || factor <= 0) throw new Error('Unit conversion factor invalid')
          qty_default = qty * factor
        }

        await applyStockMovement(this.db, {
          organization_id: org_id,
          origin_id: Number(prev.origin_id),
          ingredient_id,
          qty_delta: -qty_default,
          unit: default_unit,
          source_type: 'purchase_in_reversal',
          source_purchase_id: pid,
          source_purchase_item_id: Number(it.id) || null,
          occurred_at,
          created_by,
        })
      }

      // apply new
      return await this.processPurchaseCreated(pid, { ...meta, occurred_at })
    })
  }

  async processPurchaseDeleted(purchaseId, meta = {}) {
    const pid = PurchaseIdSchema.parse(purchaseId)
    const prev = meta?.previous
    if (!prev) return true

    return await withTransaction(this.db, async () => {
      const occurred_at = meta?.occurred_at || new Date().toISOString()
      const created_by = meta?.actor_user_id ?? null
      const org_id = Number(prev.organization_id)

      const items = Array.isArray(prev.items) ? prev.items : []
      for (const it of items) {
        const ingredient_id = Number(it.ingredient_id)
        const qty = Number(it.qty)
        if (!Number.isFinite(qty)) continue

        const ingRow = await get(
          this.db,
          `SELECT unit FROM ingredients WHERE id = ? AND organization_id = ? AND (deleted_at IS NULL OR deleted_at = '')`,
          [ingredient_id, org_id]
        )
        if (!ingRow) throw new Error('Ingredient not found')
        const default_unit = String(ingRow.unit || '').trim()
        if (!default_unit) throw new Error('Ingredient default unit is missing')

        let qty_default = qty
        const fromUnit = it.unit ? String(it.unit).trim() : ''
        if (fromUnit && fromUnit !== default_unit) {
          const conv = await get(
            this.db,
            `SELECT factor FROM ingredient_unit_conversions
             WHERE organization_id = ?
               AND ingredient_id = ?
               AND from_unit = ?
               AND to_unit = ?
               AND (deleted_at IS NULL OR deleted_at = '')`,
            [org_id, ingredient_id, fromUnit, default_unit]
          )
          if (!conv) throw new Error('Unit conversion not found')
          const factor = Number(conv.factor)
          if (!Number.isFinite(factor) || factor <= 0) throw new Error('Unit conversion factor invalid')
          qty_default = qty * factor
        }

        await applyStockMovement(this.db, {
          organization_id: org_id,
          origin_id: Number(prev.origin_id),
          ingredient_id,
          qty_delta: -qty_default,
          unit: default_unit,
          source_type: 'purchase_in_reversal',
          source_purchase_id: pid,
          source_purchase_item_id: Number(it.id) || null,
          occurred_at,
          created_by,
        })
      }

      return true
    })
  }
}

module.exports = { PurchaseSqliteDAL }
