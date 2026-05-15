const { TransferModel } = require('../../../models/TransferModel')
const {
  TransferCreateInternalSchema,
  TransferIdSchema,
  TransferRowSchema,
  TransferUpdateSchema,
} = require('../../../models/transfer/schema')
const { TransferItemApiRowSchema } = require('../../../models/transferItem/schema')
const { openSqlite } = require('../db')
const { applyTransferItemMovement } = require('../stock/applyStockMovement')

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

function normalizeTransferRow(row) {
  const parsed = TransferRowSchema.parse(row)
  const transfer_date = parsed.transfer_date || parsed.date || null
  return { ...parsed, transfer_date }
}

function normalizeTransferItemApiRow(row) {
  return TransferItemApiRowSchema.parse(row)
}

/** transfer_items ⨝ ingredients for one or many transfers (aligned with purchase_items). */
async function fetchTransferItemsJoined(db, organization_id, transferIds) {
  const ids = Array.isArray(transferIds)
    ? [...new Set(transferIds.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0))]
    : []
  if (!ids.length) return []
  const placeholders = ids.map(() => '?').join(', ')
  return await all(
    db,
    `SELECT ti.*, i.name AS ingredient_name
     FROM transfer_items ti
     LEFT JOIN ingredients i
       ON i.id = ti.ingredient_id
      AND i.organization_id = ti.organization_id
      AND (i.deleted_at IS NULL OR i.deleted_at = '')
     WHERE ti.organization_id = ?
       AND ti.transfer_id IN (${placeholders})
       AND (ti.deleted_at IS NULL OR ti.deleted_at = '')
     ORDER BY ti.transfer_id ASC, ti.id ASC`,
    [organization_id, ...ids]
  )
}

class TransferSqliteDAL extends TransferModel {
  constructor() {
    super()
    this.db = openSqlite()
  }

  async create(data) {
    const payload = TransferCreateInternalSchema.parse(data)
    const now = new Date().toISOString()
    const item_created_by = payload.created_by ?? null

    return await withTransaction(this.db, async () => {
      if (payload.from_origin_id) {
        const originRow = await get(
          this.db,
          `SELECT organization_id FROM origins WHERE id = ? AND (deleted_at IS NULL OR deleted_at = '')`,
          [payload.from_origin_id]
        )
        if (!originRow) throw new Error('Origin not found')
        if (Number(originRow.organization_id) !== payload.organization_id)
          throw new Error('Origin organization mismatch')
      }

      if (payload.to_origin_id) {
        const originRow = await get(
          this.db,
          `SELECT organization_id FROM origins WHERE id = ? AND (deleted_at IS NULL OR deleted_at = '')`,
          [payload.to_origin_id]
        )
        if (!originRow) throw new Error('Origin not found')
        if (Number(originRow.organization_id) !== payload.organization_id)
          throw new Error('Origin organization mismatch')
      }

      if (payload.from_purchase_id) {
        const purchaseRow = await get(
          this.db,
          `SELECT organization_id FROM purchases WHERE id = ? AND (deleted_at IS NULL OR deleted_at = '')`,
          [payload.from_purchase_id]
        )
        if (!purchaseRow) throw new Error('Purchase not found')
        if (Number(purchaseRow.organization_id) !== payload.organization_id)
          throw new Error('Purchase organization mismatch')
      }

      if (payload.to_utilisation_id) {
        const utilRow = await get(
          this.db,
          `SELECT organization_id FROM utilizations WHERE id = ? AND (deleted_at IS NULL OR deleted_at = '')`,
          [payload.to_utilisation_id]
        )
        if (!utilRow) throw new Error('Utilization not found')
        if (Number(utilRow.organization_id) !== payload.organization_id)
          throw new Error('Utilization organization mismatch')
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
        `INSERT INTO transfers (
           organization_id,
           from_origin_id,
           to_origin_id,
           from_purchase_id,
           to_utilisation_id,
           transfer_date,
           date,
           note,
           created_by,
           created_at,
           updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          payload.organization_id,
          payload.from_origin_id ?? null,
          payload.to_origin_id ?? null,
          payload.from_purchase_id ?? null,
          payload.to_utilisation_id ?? null,
          payload.transfer_date,
          payload.transfer_date, // keep legacy `date` in sync for older clients
          payload.note ?? null,
          item_created_by,
          now,
          now,
        ]
      )

      const transferId = result.lastID

      if (Array.isArray(payload.items) && payload.items.length) {
        for (const it of payload.items) {
          await run(
            this.db,
            `INSERT INTO transfer_items (
               organization_id,
               transfer_id,
               ingredient_id,
               qty,
               unit,
               created_by,
               created_at,
               updated_at
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              payload.organization_id,
              transferId,
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

      return await this.getById(transferId)
    })
  }

  async getById(id) {
    const tid = TransferIdSchema.parse(id)
    const row = await get(this.db, `SELECT * FROM transfers WHERE id = ?`, [tid])
    if (!row) return null
    const transfer = normalizeTransferRow(row)

    const itemRows = await fetchTransferItemsJoined(this.db, transfer.organization_id, [transfer.id])

    return { ...transfer, items: itemRows.map(normalizeTransferItemApiRow) }
  }

  async list({
    organization_id,
    page,
    limit,
    q,
    from_origin_id,
    to_origin_id,
    include_system_entry = false,
  }) {
    const where = ['organization_id = ?', `(deleted_at IS NULL OR deleted_at = '')`]
    const params = [organization_id]

    if (!include_system_entry) {
      where.push('from_origin_id IS NOT NULL')
      where.push('to_origin_id IS NOT NULL')
    }

    if (q) {
      where.push('note LIKE ?')
      params.push(`%${q}%`)
    }
    if (from_origin_id) {
      where.push('from_origin_id = ?')
      params.push(from_origin_id)
    }
    if (to_origin_id) {
      where.push('to_origin_id = ?')
      params.push(to_origin_id)
    }

    const offset = (page - 1) * limit

    const rows = await all(
      this.db,
      `SELECT * FROM transfers
       WHERE ${where.join(' AND ')}
       ORDER BY id DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    )

    const transfers = rows.map(normalizeTransferRow)
    if (!transfers.length) return transfers.map((t) => ({ ...t, items: [] }))

    const transferIds = transfers.map((t) => t.id)

    const itemRows = await fetchTransferItemsJoined(this.db, organization_id, transferIds)

    const items = itemRows.map(normalizeTransferItemApiRow)
    const byTransfer = new Map()
    for (const it of items) {
      const tid = it.transfer_id
      if (!tid) continue
      const arr = byTransfer.get(tid) || []
      arr.push(it)
      byTransfer.set(tid, arr)
    }

    return transfers.map((t) => ({ ...t, items: byTransfer.get(t.id) || [] }))
  }

  /** Transfers created for a purchase (stock-in + optional follow-up). */
  async listByPurchaseId({ organization_id, purchase_id }) {
    const pid = Number(purchase_id)
    const followUpNote = `Auto transfer after purchase #${pid}`

    const rows = await all(
      this.db,
      `SELECT * FROM transfers
       WHERE organization_id = ?
         AND (deleted_at IS NULL OR deleted_at = '')
         AND (
           from_purchase_id = ?
           OR note = ?
         )
       ORDER BY id ASC`,
      [organization_id, pid, followUpNote]
    )

    const transfers = rows.map(normalizeTransferRow)
    if (!transfers.length) return []

    const transferIds = transfers.map((t) => t.id)
    const itemRows = await fetchTransferItemsJoined(this.db, organization_id, transferIds)
    const items = itemRows.map(normalizeTransferItemApiRow)
    const byTransfer = new Map()
    for (const it of items) {
      const tid = it.transfer_id
      if (!tid) continue
      const arr = byTransfer.get(tid) || []
      arr.push(it)
      byTransfer.set(tid, arr)
    }

    return transfers.map((t) => ({ ...t, items: byTransfer.get(t.id) || [] }))
  }

  /** Transfers created for a utilization (stock-out from origin). */
  async listByUtilisationId({ organization_id, utilisation_id }) {
    const uid = Number(utilisation_id)
    const utilNote = `Auto transfer from utilization #${uid}`

    const rows = await all(
      this.db,
      `SELECT * FROM transfers
       WHERE organization_id = ?
         AND (deleted_at IS NULL OR deleted_at = '')
         AND (
           to_utilisation_id = ?
           OR note = ?
         )
       ORDER BY id ASC`,
      [organization_id, uid, utilNote]
    )

    const transfers = rows.map(normalizeTransferRow)
    if (!transfers.length) return []

    const transferIds = transfers.map((t) => t.id)
    const itemRows = await fetchTransferItemsJoined(this.db, organization_id, transferIds)
    const items = itemRows.map(normalizeTransferItemApiRow)
    const byTransfer = new Map()
    for (const it of items) {
      const tid = it.transfer_id
      if (!tid) continue
      const arr = byTransfer.get(tid) || []
      arr.push(it)
      byTransfer.set(tid, arr)
    }

    return transfers.map((t) => ({ ...t, items: byTransfer.get(t.id) || [] }))
  }

  async updateById(id, data) {
    const tid = TransferIdSchema.parse(id)
    const payload = TransferUpdateSchema.parse(data)

    const existing = await get(this.db, `SELECT * FROM transfers WHERE id = ?`, [tid])
    if (!existing) return null

    return await withTransaction(this.db, async () => {
      if (payload.from_origin_id !== undefined && payload.from_origin_id !== null) {
        const originRow = await get(
          this.db,
          `SELECT organization_id FROM origins WHERE id = ? AND (deleted_at IS NULL OR deleted_at = '')`,
          [payload.from_origin_id]
        )
        if (!originRow) throw new Error('Origin not found')
        if (Number(originRow.organization_id) !== Number(existing.organization_id))
          throw new Error('Origin organization mismatch')
      }

      if (payload.to_origin_id !== undefined && payload.to_origin_id !== null) {
        const originRow = await get(
          this.db,
          `SELECT organization_id FROM origins WHERE id = ? AND (deleted_at IS NULL OR deleted_at = '')`,
          [payload.to_origin_id]
        )
        if (!originRow) throw new Error('Origin not found')
        if (Number(originRow.organization_id) !== Number(existing.organization_id))
          throw new Error('Origin organization mismatch')
      }

      if (payload.from_purchase_id !== undefined && payload.from_purchase_id !== null) {
        const purchaseRow = await get(
          this.db,
          `SELECT organization_id FROM purchases WHERE id = ? AND (deleted_at IS NULL OR deleted_at = '')`,
          [payload.from_purchase_id]
        )
        if (!purchaseRow) throw new Error('Purchase not found')
        if (Number(purchaseRow.organization_id) !== Number(existing.organization_id))
          throw new Error('Purchase organization mismatch')
      }

      if (payload.to_utilisation_id !== undefined && payload.to_utilisation_id !== null) {
        const utilRow = await get(
          this.db,
          `SELECT organization_id FROM utilizations WHERE id = ? AND (deleted_at IS NULL OR deleted_at = '')`,
          [payload.to_utilisation_id]
        )
        if (!utilRow) throw new Error('Utilization not found')
        if (Number(utilRow.organization_id) !== Number(existing.organization_id))
          throw new Error('Utilization organization mismatch')
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
          [Number(existing.organization_id), ...ingredientIds]
        )
        if (Number(checkRow?.c || 0) !== ingredientIds.length)
          throw new Error('Ingredient organization mismatch')
      }

      const updatedAt = new Date().toISOString()

      const fields = []
      const params = []

      if (payload.from_origin_id !== undefined) {
        fields.push('from_origin_id = ?')
        params.push(payload.from_origin_id)
      }
      if (payload.to_origin_id !== undefined) {
        fields.push('to_origin_id = ?')
        params.push(payload.to_origin_id)
      }
      if (payload.from_purchase_id !== undefined) {
        fields.push('from_purchase_id = ?')
        params.push(payload.from_purchase_id)
      }
      if (payload.to_utilisation_id !== undefined) {
        fields.push('to_utilisation_id = ?')
        params.push(payload.to_utilisation_id)
      }
      if (payload.transfer_date !== undefined) {
        fields.push('transfer_date = ?')
        params.push(payload.transfer_date)
        fields.push('date = ?')
        params.push(payload.transfer_date)
      }
      if (payload.note !== undefined) {
        fields.push('note = ?')
        params.push(payload.note)
      }

      fields.push('updated_at = ?')
      params.push(updatedAt)

      await run(this.db, `UPDATE transfers SET ${fields.join(', ')} WHERE id = ?`, [...params, tid])

      if (Array.isArray(payload.items)) {
        const orgId = Number(existing.organization_id)
        const itemCreatedBy = existing.created_by ?? null

        await run(
          this.db,
          `UPDATE transfer_items SET deleted_at = ?, updated_at = ?
           WHERE transfer_id = ? AND organization_id = ?
             AND (deleted_at IS NULL OR deleted_at = '')`,
          [updatedAt, updatedAt, tid, orgId]
        )

        for (const it of payload.items) {
          await run(
            this.db,
            `INSERT INTO transfer_items (
               organization_id,
               transfer_id,
               ingredient_id,
               qty,
               unit,
               created_by,
               created_at,
               updated_at
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              orgId,
              tid,
              it.ingredient_id,
              it.qty,
              it.unit,
              itemCreatedBy,
              updatedAt,
              updatedAt,
            ]
          )
        }
      }

      return await this.getById(tid)
    })
  }

  async deleteById(id) {
    const tid = TransferIdSchema.parse(id)
    const now = new Date().toISOString()

    return await withTransaction(this.db, async () => {
      const existing = await get(this.db, `SELECT * FROM transfers WHERE id = ?`, [tid])
      if (!existing) return false
      if (existing.deleted_at) return true

      await run(this.db, `UPDATE transfers SET deleted_at = ?, updated_at = ? WHERE id = ?`, [
        now,
        now,
        tid,
      ])
      await run(
        this.db,
        `UPDATE transfer_items SET deleted_at = ?, updated_at = ? WHERE transfer_id = ?`,
        [now, now, tid]
      )
      return true
    })
  }

  /**
   * @param {{ organization_id: number, transfer_ids: number[] }} params
   */
  async groupItemsByIngredient({ organization_id, transfer_ids }) {
    const org = Number(organization_id)
    if (!Number.isFinite(org) || org <= 0) throw new Error('Invalid organization_id')

    const ids = Array.isArray(transfer_ids)
      ? [...new Set(transfer_ids.map((id) => Number(id)).filter((n) => Number.isFinite(n) && n > 0))]
      : []

    if (!ids.length) {
      return { transfer_ids: [], found_transfer_ids: [], missing_ids: [], items: [], subtotal: 0 }
    }

    const placeholders = ids.map(() => '?').join(', ')

    const transferRows = await all(
      this.db,
      `SELECT id
       FROM transfers
       WHERE organization_id = ?
         AND id IN (${placeholders})
         AND (deleted_at IS NULL OR deleted_at = '')`,
      [org, ...ids]
    )
    const foundTransferIds = transferRows.map((r) => Number(r.id)).filter((n) => Number.isFinite(n))
    const missingIds = ids.filter((id) => !foundTransferIds.includes(id))

    if (!foundTransferIds.length) {
      return { transfer_ids: ids, found_transfer_ids: [], missing_ids: missingIds, items: [], subtotal: 0 }
    }

    const foundPlaceholders = foundTransferIds.map(() => '?').join(', ')

    const rows = await all(
      this.db,
      `SELECT ti.ingredient_id,
              ti.qty,
              ti.unit,
              i.name AS ingredient_name,
              i.unit AS default_unit
       FROM transfer_items ti
       LEFT JOIN ingredients i
         ON i.id = ti.ingredient_id
        AND i.organization_id = ti.organization_id
        AND (i.deleted_at IS NULL OR i.deleted_at = '')
       WHERE ti.organization_id = ?
         AND ti.transfer_id IN (${foundPlaceholders})
         AND (ti.deleted_at IS NULL OR ti.deleted_at = '')`,
      [org, ...foundTransferIds]
    )

    if (!rows.length) {
      return { transfer_ids: ids, found_transfer_ids: foundTransferIds, missing_ids: missingIds, items: [], subtotal: 0 }
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
      transfer_ids: ids,
      found_transfer_ids: foundTransferIds,
      missing_ids: missingIds,
      items,
      subtotal: 0,
    }
  }

  /**
   * @param {{ organization_id: number, transfer_ids: number[] }} params
   */
  async getAllItems({ organization_id, transfer_ids }) {
    const org = Number(organization_id)
    if (!Number.isFinite(org) || org <= 0) throw new Error('Invalid organization_id')

    const ids = Array.isArray(transfer_ids)
      ? [...new Set(transfer_ids.map((id) => Number(id)).filter((n) => Number.isFinite(n) && n > 0))]
      : []

    if (!ids.length) {
      return { transfer_ids: [], found_transfer_ids: [], missing_ids: [], items: [], subtotal: 0 }
    }

    const placeholders = ids.map(() => '?').join(', ')

    const transferRows = await all(
      this.db,
      `SELECT id
       FROM transfers
       WHERE organization_id = ?
         AND id IN (${placeholders})
         AND (deleted_at IS NULL OR deleted_at = '')`,
      [org, ...ids]
    )
    const foundTransferIds = transferRows.map((r) => Number(r.id)).filter((n) => Number.isFinite(n))
    const missingIds = ids.filter((id) => !foundTransferIds.includes(id))

    if (!foundTransferIds.length) {
      return { transfer_ids: ids, found_transfer_ids: [], missing_ids: missingIds, items: [], subtotal: 0 }
    }

    const foundPlaceholders = foundTransferIds.map(() => '?').join(', ')
    const itemParams = [org, ...foundTransferIds]

    const rows = await all(
      this.db,
      `SELECT ti.id,
              ti.organization_id,
              ti.transfer_id,
              ti.ingredient_id,
              ti.qty,
              ti.unit,
              ti.created_by,
              ti.created_at,
              ti.updated_at,
              ti.deleted_at,
              i.name AS ingredient_name,
              i.unit AS ingredient_default_unit,
              i.item_code
       FROM transfer_items ti
       LEFT JOIN ingredients i
         ON i.id = ti.ingredient_id
        AND i.organization_id = ti.organization_id
        AND (i.deleted_at IS NULL OR i.deleted_at = '')
       WHERE ti.organization_id = ?
         AND ti.transfer_id IN (${foundPlaceholders})
         AND (ti.deleted_at IS NULL OR ti.deleted_at = '')
       ORDER BY ti.transfer_id ASC, ti.id ASC`,
      itemParams
    )

    const items = rows.map((r) => normalizeTransferItemApiRow(r))
    return {
      transfer_ids: ids,
      found_transfer_ids: foundTransferIds,
      missing_ids: missingIds,
      items,
      subtotal: 0,
    }
  }

  async processTransferCreated(transferId, meta = {}) {
    const tid = TransferIdSchema.parse(transferId)
    return await withTransaction(this.db, async () => {
      const transfer = await this.getById(tid)
      if (!transfer) throw new Error('Transfer not found')
      if (transfer.deleted_at) return true

      const occurred_at = meta?.occurred_at || transfer.transfer_date || new Date().toISOString()
      const created_by = meta?.actor_user_id ?? null

      const items = Array.isArray(transfer.items) ? transfer.items : []
      for (const it of items) {
        await applyTransferItemMovement(this.db, {
          organization_id: Number(transfer.organization_id),
          from_origin_id: transfer.from_origin_id ?? null,
          to_origin_id: transfer.to_origin_id ?? null,
          ingredient_id: Number(it.ingredient_id),
          qty: Number(it.qty),
          unit: String(it.unit ?? ''),
          source_transfer_id: tid,
          source_transfer_item_id: Number(it.id) || null,
          occurred_at,
          created_by,
          reversal: false,
        })
      }
      return true
    })
  }

  async processTransferUpdated(transferId, meta = {}) {
    const tid = TransferIdSchema.parse(transferId)
    const prev = meta?.previous
    const next = meta?.next
    if (!prev || !next) return await this.processTransferCreated(tid, meta)

    return await withTransaction(this.db, async () => {
      const occurred_at = meta?.occurred_at || next.transfer_date || new Date().toISOString()
      const created_by = meta?.actor_user_id ?? null
      const items = Array.isArray(next.items) ? next.items : []

      for (const it of items) {
        await applyTransferItemMovement(this.db, {
          organization_id: Number(next.organization_id),
          from_origin_id: prev.from_origin_id ?? null,
          to_origin_id: prev.to_origin_id ?? null,
          ingredient_id: Number(it.ingredient_id),
          qty: Number(it.qty),
          unit: String(it.unit ?? ''),
          source_transfer_id: tid,
          source_transfer_item_id: Number(it.id) || null,
          occurred_at,
          created_by,
          reversal: true,
        })
        await applyTransferItemMovement(this.db, {
          organization_id: Number(next.organization_id),
          from_origin_id: next.from_origin_id ?? null,
          to_origin_id: next.to_origin_id ?? null,
          ingredient_id: Number(it.ingredient_id),
          qty: Number(it.qty),
          unit: String(it.unit ?? ''),
          source_transfer_id: tid,
          source_transfer_item_id: Number(it.id) || null,
          occurred_at,
          created_by,
          reversal: false,
        })
      }
      return true
    })
  }

  async processTransferDeleted(transferId, meta = {}) {
    const tid = TransferIdSchema.parse(transferId)
    const prev = meta?.previous
    if (!prev) return true

    return await withTransaction(this.db, async () => {
      const occurred_at = meta?.occurred_at || new Date().toISOString()
      const created_by = meta?.actor_user_id ?? null
      const items = Array.isArray(prev.items) ? prev.items : []

      for (const it of items) {
        await applyTransferItemMovement(this.db, {
          organization_id: Number(prev.organization_id),
          from_origin_id: prev.from_origin_id ?? null,
          to_origin_id: prev.to_origin_id ?? null,
          ingredient_id: Number(it.ingredient_id),
          qty: Number(it.qty),
          unit: String(it.unit ?? ''),
          source_transfer_id: tid,
          source_transfer_item_id: Number(it.id) || null,
          occurred_at,
          created_by,
          reversal: true,
        })
      }
      return true
    })
  }
}

module.exports = { TransferSqliteDAL }

