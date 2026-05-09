const { TransferModel } = require('../../../models/TransferModel')
const {
  TransferCreateInternalSchema,
  TransferIdSchema,
  TransferRowSchema,
  TransferUpdateSchema,
} = require('../../../models/transfer/schema')
const { TransferItemRowSchema } = require('../../../models/transferItem/schema')
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

function normalizeItemRow(row) {
  return TransferItemRowSchema.parse(row)
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

    const itemRows = await all(
      this.db,
      `SELECT * FROM transfer_items
       WHERE organization_id = ?
         AND transfer_id = ?
         AND (deleted_at IS NULL OR deleted_at = '')`,
      [transfer.organization_id, transfer.id]
    )

    return { ...transfer, items: itemRows.map(normalizeItemRow) }
  }

  async list({ organization_id, page, limit, q, from_origin_id, to_origin_id }) {
    const where = ['organization_id = ?', `(deleted_at IS NULL OR deleted_at = '')`]
    const params = [organization_id]

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
    const placeholders = transferIds.map(() => '?').join(', ')

    const itemRows = await all(
      this.db,
      `SELECT * FROM transfer_items
       WHERE organization_id = ?
         AND transfer_id IN (${placeholders})
         AND (deleted_at IS NULL OR deleted_at = '')`,
      [organization_id, ...transferIds]
    )

    const items = itemRows.map(normalizeItemRow)
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

