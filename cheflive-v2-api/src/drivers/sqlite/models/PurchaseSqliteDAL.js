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

  /**
   * Group purchase line items by ingredient across one or more purchases (same org scope).
   *
   * For each line, qty is converted to the ingredient's default unit using
   * `ingredient_unit_conversions` (same rule as `processPurchaseCreated`). Since the same
   * ingredient can be purchased at different prices over time, a single `unit_price` would be
   * misleading; instead each grouped row exposes the aggregated money spent on that ingredient
   * as `subtotal`. The top-level `subtotal` is the sum of all per-ingredient subtotals.
   *
   * @param {{ organization_id: number, purchase_ids: number[] }} params
   * @returns {Promise<{
   *   purchase_ids: number[],
   *   found_purchase_ids: number[],
   *   missing_ids: number[],
   *   items: Array<{
   *     ingredient_id: number,
   *     ingredient_name: string|null,
   *     qty: number,
   *     unit: string,
   *     subtotal: number,
   *   }>,
   *   subtotal: number,
   * }>}
   */
  async groupItemsByIngredient({ organization_id, purchase_ids }) {
    const org = Number(organization_id)
    if (!Number.isFinite(org) || org <= 0) throw new Error('Invalid organization_id')

    const ids = Array.isArray(purchase_ids)
      ? [...new Set(purchase_ids.map((id) => Number(id)).filter((n) => Number.isFinite(n) && n > 0))]
      : []

    if (!ids.length) {
      return { purchase_ids: [], found_purchase_ids: [], missing_ids: [], items: [], subtotal: 0 }
    }

    const placeholders = ids.map(() => '?').join(', ')

    // Resolve which requested ids actually exist for this org (and aren't soft-deleted).
    const purchaseRows = await all(
      this.db,
      `SELECT id
       FROM purchases
       WHERE organization_id = ?
         AND id IN (${placeholders})
         AND (deleted_at IS NULL OR deleted_at = '')`,
      [org, ...ids]
    )
    const foundPurchaseIds = purchaseRows.map((r) => Number(r.id)).filter((n) => Number.isFinite(n))
    const missingIds = ids.filter((id) => !foundPurchaseIds.includes(id))

    if (!foundPurchaseIds.length) {
      return { purchase_ids: ids, found_purchase_ids: [], missing_ids: missingIds, items: [], subtotal: 0 }
    }

    const foundPlaceholders = foundPurchaseIds.map(() => '?').join(', ')

    // Fetch all line items joined with the ingredient's default unit/name.
    const rows = await all(
      this.db,
      `SELECT pi.ingredient_id,
              pi.qty,
              pi.unit,
              pi.unit_price,
              pi.purchase_id,
              i.name AS ingredient_name,
              i.unit AS default_unit
       FROM purchase_items pi
       LEFT JOIN ingredients i
         ON i.id = pi.ingredient_id
        AND i.organization_id = pi.organization_id
        AND (i.deleted_at IS NULL OR i.deleted_at = '')
       WHERE pi.organization_id = ?
         AND pi.purchase_id IN (${foundPlaceholders})
         AND (pi.deleted_at IS NULL OR pi.deleted_at = '')`,
      [org, ...foundPurchaseIds]
    )

    if (!rows.length) {
      return { purchase_ids: ids, found_purchase_ids: foundPurchaseIds, missing_ids: missingIds, items: [], subtotal: 0 }
    }

    // Pre-fetch conversions for all involved ingredients.
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
      if (!defaultUnit) {
        // Ingredient missing default unit: skip rather than corrupt totals.
        continue
      }

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

      const rawPrice = r.unit_price
      const priceNum =
        rawPrice === null || rawPrice === undefined || rawPrice === '' ? NaN : Number(rawPrice)
      const hasPrice = Number.isFinite(priceNum)
      // qty (in any unit) × unit_price (per that same unit) = spend (currency), unit-agnostic.
      const lineTotal = hasPrice ? rawQty * priceNum : 0

      let g = grouped.get(ingredient_id)
      if (!g) {
        g = {
          ingredient_id,
          ingredient_name: r.ingredient_name ?? null,
          unit: defaultUnit,
          qty: 0,
          subtotal: 0,
        }
        grouped.set(ingredient_id, g)
      }

      g.qty += qtyDefault
      if (hasPrice) g.subtotal += lineTotal
    }

    const items = []
    let subtotal = 0
    for (const g of grouped.values()) {
      items.push({
        ingredient_id: g.ingredient_id,
        ingredient_name: g.ingredient_name,
        qty: g.qty,
        unit: g.unit,
        subtotal: g.subtotal,
      })
      subtotal += g.subtotal
    }

    items.sort((a, b) =>
      String(a.ingredient_name || '').localeCompare(String(b.ingredient_name || '')),
    )

    return {
      purchase_ids: ids,
      found_purchase_ids: foundPurchaseIds,
      missing_ids: missingIds,
      items,
      subtotal,
    }
  }

  /**
   * Ingredients at the default origin where current stock is below reorder threshold.
   * Returns purchase-line-ready rows in a single query.
   *
   * @param {{ organization_id: number }} params
   */
  async getItemsByLowStock({ organization_id }) {
    const org = Number(organization_id)
    if (!Number.isFinite(org) || org <= 0) throw new Error('Invalid organization_id')

    const rows = await all(
      this.db,
      `SELECT rs.ingredient_id,
              rs.qty AS current_stock_qty,
              rs.reorder_threshold_qty,
              rs.minimum_reorder_qty,
              i.name AS ingredient_name,
              i.item_code,
              i.unit,
              i.base_price
       FROM running_stock rs
       INNER JOIN origins o
         ON o.id = rs.origin_id
        AND o.organization_id = rs.organization_id
        AND o.is_default = 1
        AND (o.deleted_at IS NULL OR o.deleted_at = '')
       INNER JOIN ingredients i
         ON i.id = rs.ingredient_id
        AND i.organization_id = rs.organization_id
        AND (i.deleted_at IS NULL OR i.deleted_at = '')
       WHERE rs.organization_id = ?
         AND (rs.deleted_at IS NULL OR rs.deleted_at = '')
         AND rs.reorder_threshold_qty IS NOT NULL
         AND rs.qty < rs.reorder_threshold_qty
       ORDER BY i.name COLLATE NOCASE ASC`,
      [org]
    )

    const items = rows.map((r) => {
      const current = Number(r.current_stock_qty) || 0
      const threshold = Number(r.reorder_threshold_qty)
      const minReorder = r.minimum_reorder_qty != null ? Number(r.minimum_reorder_qty) : null
      const unit = String(r.unit || '').trim()

      // Suggested purchase qty: prefer configured minimum reorder; else gap to threshold.
      let qty
      if (minReorder != null && Number.isFinite(minReorder) && minReorder > 0) {
        qty = minReorder
      } else if (Number.isFinite(threshold) && threshold > current) {
        qty = threshold - current
      } else {
        qty = threshold
      }

      const basePrice = r.base_price != null ? Number(r.base_price) : null

      return {
        ingredient_id: Number(r.ingredient_id),
        ingredient_name: r.ingredient_name ?? null,
        item_code: r.item_code ?? null,
        unit,
        base_price: Number.isFinite(basePrice) ? basePrice : null,
        current_stock_qty: current,
        reorder_threshold_qty: threshold,
        minimum_reorder_qty: minReorder,
        qty,
        unit_price: Number.isFinite(basePrice) ? basePrice : null,
      }
    })

    return { items }
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
