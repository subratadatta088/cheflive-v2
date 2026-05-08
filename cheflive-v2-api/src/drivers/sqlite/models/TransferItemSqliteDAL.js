const { TransferItemModel } = require('../../../models/TransferItemModel')
const {
  TransferItemCreateSchema,
  TransferItemIdSchema,
  TransferItemListQuerySchema,
  TransferItemRowSchema,
  TransferItemUpdateSchema,
} = require('../../../models/transferItem/schema')
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

function normalizeRow(row) {
  return TransferItemRowSchema.parse(row)
}

async function loadParentTransfer(db, transferId) {
  return await get(
    db,
    `SELECT id, organization_id, from_origin_id, to_origin_id, transfer_date, date, deleted_at
     FROM transfers
     WHERE id = ?`,
    [transferId]
  )
}

class TransferItemSqliteDAL extends TransferItemModel {
  constructor() {
    super()
    this.db = openSqlite()
  }

  async create(data) {
    const payload = TransferItemCreateSchema.parse(data)
    const now = new Date().toISOString()

    return await withTransaction(this.db, async () => {
      const transferRow = await loadParentTransfer(this.db, payload.transfer_id)
      if (!transferRow || transferRow.deleted_at) throw new Error('Transfer not found')
      if (Number(transferRow.organization_id) !== payload.organization_id)
        throw new Error('Transfer organization mismatch')

      const ingRow = await get(
        this.db,
        `SELECT organization_id FROM ingredients WHERE id = ? AND (deleted_at IS NULL OR deleted_at = '')`,
        [payload.ingredient_id]
      )
      if (!ingRow) throw new Error('Ingredient not found')
      if (Number(ingRow.organization_id) !== payload.organization_id)
        throw new Error('Ingredient organization mismatch')

      const result = await run(
        this.db,
        `INSERT INTO transfer_items (organization_id, transfer_id, ingredient_id, qty, unit_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          payload.organization_id,
          payload.transfer_id,
          payload.ingredient_id,
          payload.qty,
          payload.unit_id ?? null,
          now,
          now,
        ]
      )

      await applyTransferItemMovement(this.db, {
        organization_id: payload.organization_id,
        from_origin_id: transferRow.from_origin_id ?? null,
        to_origin_id: transferRow.to_origin_id ?? null,
        ingredient_id: payload.ingredient_id,
        qty: payload.qty,
        unit_id: payload.unit_id ?? null,
        source_transfer_id: payload.transfer_id,
        source_transfer_item_id: result.lastID,
        occurred_at: transferRow.transfer_date || transferRow.date || now,
        created_by: null,
      })

      const created = await get(this.db, `SELECT * FROM transfer_items WHERE id = ?`, [
        result.lastID,
      ])
      return created ? normalizeRow(created) : null
    })
  }

  async getById(id) {
    const itemId = TransferItemIdSchema.parse(id)
    const row = await get(this.db, `SELECT * FROM transfer_items WHERE id = ?`, [itemId])
    if (!row) return null
    return normalizeRow(row)
  }

  async list(query) {
    const q = TransferItemListQuerySchema.parse(query)
    if (!q.organization_id) throw new Error('organization_id is required')

    const where = ['organization_id = ?', `(deleted_at IS NULL OR deleted_at = '')`]
    const params = [q.organization_id]

    if (q.transfer_id) {
      where.push('transfer_id = ?')
      params.push(q.transfer_id)
    }

    const offset = (q.page - 1) * q.limit

    const rows = await all(
      this.db,
      `SELECT * FROM transfer_items
       WHERE ${where.join(' AND ')}
       ORDER BY id DESC
       LIMIT ? OFFSET ?`,
      [...params, q.limit, offset]
    )

    return rows.map(normalizeRow)
  }

  async updateById(id, data) {
    const itemId = TransferItemIdSchema.parse(id)
    const payload = TransferItemUpdateSchema.parse(data)

    return await withTransaction(this.db, async () => {
      const existing = await get(this.db, `SELECT * FROM transfer_items WHERE id = ?`, [itemId])
      if (!existing) return null
      if (existing.deleted_at) return null

      const transferRow = await loadParentTransfer(this.db, existing.transfer_id)
      if (!transferRow) throw new Error('Transfer not found')

      const oldQty = Number(existing.qty)
      const oldUnitId = existing.unit_id ?? null
      const newQty = payload.qty !== undefined ? Number(payload.qty) : oldQty
      const newUnitId = payload.unit_id !== undefined ? payload.unit_id : oldUnitId

      const stockMutated = newQty !== oldQty || (newUnitId ?? null) !== (oldUnitId ?? null)

      const now = new Date().toISOString()
      const occurredAt = transferRow.transfer_date || transferRow.date || now

      if (stockMutated) {
        await applyTransferItemMovement(this.db, {
          organization_id: Number(existing.organization_id),
          from_origin_id: transferRow.from_origin_id ?? null,
          to_origin_id: transferRow.to_origin_id ?? null,
          ingredient_id: Number(existing.ingredient_id),
          qty: oldQty,
          unit_id: oldUnitId,
          source_transfer_id: Number(existing.transfer_id),
          source_transfer_item_id: itemId,
          occurred_at: occurredAt,
          created_by: null,
          reversal: true,
        })

        await applyTransferItemMovement(this.db, {
          organization_id: Number(existing.organization_id),
          from_origin_id: transferRow.from_origin_id ?? null,
          to_origin_id: transferRow.to_origin_id ?? null,
          ingredient_id: Number(existing.ingredient_id),
          qty: newQty,
          unit_id: newUnitId,
          source_transfer_id: Number(existing.transfer_id),
          source_transfer_item_id: itemId,
          occurred_at: occurredAt,
          created_by: null,
          reversal: false,
        })
      }

      const fields = []
      const params = []

      if (payload.qty !== undefined) {
        fields.push('qty = ?')
        params.push(payload.qty)
      }
      if (payload.unit_id !== undefined) {
        fields.push('unit_id = ?')
        params.push(payload.unit_id)
      }

      fields.push('updated_at = ?')
      params.push(now)

      await run(this.db, `UPDATE transfer_items SET ${fields.join(', ')} WHERE id = ?`, [
        ...params,
        itemId,
      ])

      const updated = await get(this.db, `SELECT * FROM transfer_items WHERE id = ?`, [itemId])
      return updated ? normalizeRow(updated) : null
    })
  }

  async deleteById(id) {
    const itemId = TransferItemIdSchema.parse(id)
    const now = new Date().toISOString()

    return await withTransaction(this.db, async () => {
      const existing = await get(this.db, `SELECT * FROM transfer_items WHERE id = ?`, [itemId])
      if (!existing) return false
      if (existing.deleted_at) return true

      const transferRow = await loadParentTransfer(this.db, existing.transfer_id)
      if (transferRow && !transferRow.deleted_at) {
        await applyTransferItemMovement(this.db, {
          organization_id: Number(existing.organization_id),
          from_origin_id: transferRow.from_origin_id ?? null,
          to_origin_id: transferRow.to_origin_id ?? null,
          ingredient_id: Number(existing.ingredient_id),
          qty: Number(existing.qty),
          unit_id: existing.unit_id ?? null,
          source_transfer_id: Number(existing.transfer_id),
          source_transfer_item_id: itemId,
          occurred_at: transferRow.transfer_date || transferRow.date || now,
          created_by: null,
          reversal: true,
        })
      }

      await run(this.db, `UPDATE transfer_items SET deleted_at = ?, updated_at = ? WHERE id = ?`, [
        now,
        now,
        itemId,
      ])
      return true
    })
  }
}

module.exports = { TransferItemSqliteDAL }
