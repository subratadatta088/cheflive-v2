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

const VALID_SOURCE_TYPES = new Set([
  'transfer_in',
  'transfer_out',
  'transfer_in_reversal',
  'transfer_out_reversal',
])

/**
 * Convert qty from a transfer-item-supplied unit into the ingredient's default unit
 * (`ingredients.unit`). Behavior:
 *  - If `unit_id` is null/undefined, the qty is assumed to already be in the default
 *    unit; it is returned unchanged.
 *  - If `unit_id` is set, it is treated as the row id in `ingredient_unit_conversions`
 *    that defines the conversion. The conversion row must reference the same
 *    organization + ingredient and must involve the ingredient's default unit on one
 *    side; otherwise an error is thrown.
 *
 * @param {import('sqlite3').Database} db Caller-supplied connection (joins existing txn).
 * @param {{
 *   organization_id: number,
 *   ingredient_id: number,
 *   qty: number,
 *   unit_id?: number|null,
 * }} params
 * @returns {Promise<{ qty_default: number, default_unit: string }>}
 */
async function convertToDefaultUnit(db, { organization_id, ingredient_id, qty, unit_id }) {
  const ingRow = await get(
    db,
    `SELECT unit FROM ingredients
     WHERE id = ?
       AND organization_id = ?
       AND (deleted_at IS NULL OR deleted_at = '')`,
    [ingredient_id, organization_id]
  )
  if (!ingRow) throw new Error('Ingredient not found')
  const default_unit = String(ingRow.unit || '').trim()
  if (!default_unit) throw new Error('Ingredient default unit is missing')

  const numQty = Number(qty)
  if (!Number.isFinite(numQty)) throw new Error('Invalid qty for stock movement')

  if (unit_id === undefined || unit_id === null) {
    return { qty_default: numQty, default_unit }
  }

  const conv = await get(
    db,
    `SELECT from_unit, to_unit, factor FROM ingredient_unit_conversions
     WHERE id = ?
       AND organization_id = ?
       AND ingredient_id = ?
       AND (deleted_at IS NULL OR deleted_at = '')`,
    [unit_id, organization_id, ingredient_id]
  )
  if (!conv) throw new Error('Unit conversion not found')

  const factor = Number(conv.factor)
  if (!Number.isFinite(factor) || factor <= 0) {
    throw new Error('Unit conversion factor invalid')
  }

  // qty is provided in `from_unit`; converted qty in `to_unit` = qty * factor.
  // Surface the value expressed in the ingredient's default unit.
  if (conv.to_unit === default_unit) {
    return { qty_default: numQty * factor, default_unit }
  }
  if (conv.from_unit === default_unit) {
    return { qty_default: numQty, default_unit }
  }
  throw new Error('Unit conversion does not match ingredient default unit')
}

/**
 * Apply a signed qty delta (in the ingredient's default unit) to `running_stock`,
 * and append a snapshot row to `stock_transition_states`. Both writes happen on the
 * caller's connection so they participate in the caller's transaction.
 *
 * @param {import('sqlite3').Database} db Caller-supplied connection (joins existing txn).
 * @param {{
 *   organization_id: number,
 *   origin_id: number,
 *   ingredient_id: number,
 *   qty_delta: number,         // signed, in default unit
 *   unit: string,              // ingredient default unit
 *   source_type: 'transfer_in'|'transfer_out'|'transfer_in_reversal'|'transfer_out_reversal',
 *   source_transfer_id?: number|null,
 *   source_transfer_item_id?: number|null,
 *   occurred_at: string,       // ISO timestamp
 *   created_by?: number|null,
 * }} params
 * @returns {Promise<{ qty_before: number, qty_after: number, running_stock_id: number }>}
 */
async function applyStockMovement(db, params) {
  const {
    organization_id,
    origin_id,
    ingredient_id,
    qty_delta,
    unit,
    source_type,
    source_transfer_id = null,
    source_transfer_item_id = null,
    occurred_at,
    created_by = null,
  } = params

  if (!organization_id) throw new Error('applyStockMovement: organization_id is required')
  if (!origin_id) throw new Error('applyStockMovement: origin_id is required')
  if (!ingredient_id) throw new Error('applyStockMovement: ingredient_id is required')
  if (!unit) throw new Error('applyStockMovement: unit is required')
  if (!occurred_at) throw new Error('applyStockMovement: occurred_at is required')
  if (!VALID_SOURCE_TYPES.has(source_type)) {
    throw new Error(`applyStockMovement: invalid source_type "${source_type}"`)
  }

  const delta = Number(qty_delta)
  if (!Number.isFinite(delta)) throw new Error('applyStockMovement: qty_delta must be finite')

  const now = new Date().toISOString()

  const existing = await get(
    db,
    `SELECT id, qty FROM running_stock
     WHERE organization_id = ? AND origin_id = ? AND ingredient_id = ?`,
    [organization_id, origin_id, ingredient_id]
  )

  const qty_before = existing ? Number(existing.qty) || 0 : 0
  const qty_after = qty_before + delta

  let running_stock_id
  if (existing) {
    await run(
      db,
      `UPDATE running_stock
         SET qty = ?, unit = ?, updated_at = ?, deleted_at = NULL
       WHERE id = ?`,
      [qty_after, unit, now, existing.id]
    )
    running_stock_id = existing.id
  } else {
    const ins = await run(
      db,
      `INSERT INTO running_stock (
         organization_id, origin_id, ingredient_id, qty, unit, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [organization_id, origin_id, ingredient_id, qty_after, unit, now, now]
    )
    running_stock_id = ins.lastID
  }

  await run(
    db,
    `INSERT INTO stock_transition_states (
       organization_id, origin_id, ingredient_id, unit,
       qty_before, qty_delta, qty_after,
       source_type, source_transfer_id, source_transfer_item_id,
       occurred_at, created_at, created_by
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      organization_id,
      origin_id,
      ingredient_id,
      unit,
      qty_before,
      delta,
      qty_after,
      source_type,
      source_transfer_id,
      source_transfer_item_id,
      occurred_at,
      now,
      created_by,
    ]
  )

  return { qty_before, qty_after, running_stock_id }
}

/**
 * Convenience wrapper: convert + apply both legs (credit `to_origin_id`, debit
 * `from_origin_id`) for a single transfer item, in the caller's transaction.
 *
 * @param {import('sqlite3').Database} db
 * @param {{
 *   organization_id: number,
 *   from_origin_id?: number|null,
 *   to_origin_id?: number|null,
 *   ingredient_id: number,
 *   qty: number,
 *   unit_id?: number|null,
 *   source_transfer_id?: number|null,
 *   source_transfer_item_id?: number|null,
 *   occurred_at: string,
 *   created_by?: number|null,
 *   reversal?: boolean,         // when true, reverse the original effect
 * }} params
 */
async function applyTransferItemMovement(db, params) {
  const {
    organization_id,
    from_origin_id,
    to_origin_id,
    ingredient_id,
    qty,
    unit_id,
    source_transfer_id = null,
    source_transfer_item_id = null,
    occurred_at,
    created_by = null,
    reversal = false,
  } = params

  const { qty_default, default_unit } = await convertToDefaultUnit(db, {
    organization_id,
    ingredient_id,
    qty,
    unit_id,
  })

  if (to_origin_id) {
    await applyStockMovement(db, {
      organization_id,
      origin_id: to_origin_id,
      ingredient_id,
      qty_delta: reversal ? -qty_default : +qty_default,
      unit: default_unit,
      source_type: reversal ? 'transfer_in_reversal' : 'transfer_in',
      source_transfer_id,
      source_transfer_item_id,
      occurred_at,
      created_by,
    })
  }

  if (from_origin_id) {
    await applyStockMovement(db, {
      organization_id,
      origin_id: from_origin_id,
      ingredient_id,
      qty_delta: reversal ? +qty_default : -qty_default,
      unit: default_unit,
      source_type: reversal ? 'transfer_out_reversal' : 'transfer_out',
      source_transfer_id,
      source_transfer_item_id,
      occurred_at,
      created_by,
    })
  }
}

module.exports = {
  applyStockMovement,
  applyTransferItemMovement,
  convertToDefaultUnit,
}
