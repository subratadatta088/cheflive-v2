const { events, EventTypes } = require('../events')
const {
  calculateTransferStockAdjustments,
} = require('./inventory/calculateTransferDelta')

class StockService {
  /**
   * @param {{ models: any, user: any }} ctx
   */
  constructor(ctx) {
    this.models = ctx?.models
    this.user = ctx?.user
  }

  /**
   * Apply a transfer's stock effect into running_stock (no transitions here),
   * then emit StockUpdated events (one per origin+ingredient delta).
   *
   * @param {any} transfer Transfer row with items (from models.transfer.getById)
   */
  async applyTransfer(transfer) {
    const t = transfer
    const occurred_at = t.transfer_date || t.date || new Date().toISOString()
    const actor_user_id = this.user?.id ?? null

    const items = Array.isArray(t.items) ? t.items : []
    for (const it of items) {
      const ingredient_id = Number(it.ingredient_id)
      const qty = Number(it.qty)
      await this._applyTransferIngredientLegs({
        transfer: t,
        ingredient_id,
        qty_delta: qty,
        transfer_item_id: Number(it.id) || null,
        occurred_at,
        actor_user_id,
        source_type_in: 'transfer_in',
        source_type_out: 'transfer_out',
      })
    }
  }

  /**
   * Revert a transfer's prior stock effect (used when origins change on edit or on delete).
   * @param {any} transfer Transfer row with items
   */
  async revertTransfer(transfer) {
    const t = transfer
    const occurred_at = t.transfer_date || t.date || new Date().toISOString()
    const actor_user_id = this.user?.id ?? null

    const items = Array.isArray(t.items) ? t.items : []
    for (const it of items) {
      const ingredient_id = Number(it.ingredient_id)
      const qty = Number(it.qty)
      await this._applyTransferIngredientLegs({
        transfer: t,
        ingredient_id,
        qty_delta: -qty,
        transfer_item_id: Number(it.id) || null,
        occurred_at,
        actor_user_id,
        source_type_in: 'transfer_in_reversal',
        source_type_out: 'transfer_out_reversal',
      })
    }
  }

  /**
   * Apply differential stock adjustments after a transfer edit (qty and/or line changes).
   * @param {any} previous Snapshot before update
   * @param {any} next Snapshot after update
   */
  async applyTransferEditAdjustments(previous, next) {
    const plan = calculateTransferStockAdjustments(previous, next)
    const occurred_at = next.transfer_date || next.date || new Date().toISOString()
    const actor_user_id = this.user?.id ?? null

    if (plan.mode === 'replace') {
      await this._applyTransferLegPlan({
        organization_id: plan.revert.organization_id,
        transfer_id: Number(next.id),
        from_origin_id: plan.revert.from_origin_id,
        to_origin_id: plan.revert.to_origin_id,
        items: plan.revert.items,
        sign: -1,
        occurred_at,
        actor_user_id,
        source_type_in: 'transfer_in_reversal',
        source_type_out: 'transfer_out_reversal',
      })
      await this._applyTransferLegPlan({
        organization_id: plan.apply.organization_id,
        transfer_id: Number(next.id),
        from_origin_id: plan.apply.from_origin_id,
        to_origin_id: plan.apply.to_origin_id,
        items: plan.apply.items,
        sign: 1,
        occurred_at,
        actor_user_id,
        source_type_in: 'transfer_in',
        source_type_out: 'transfer_out',
      })
      return
    }

    const orgId = Number(next.organization_id)
    for (const d of plan.deltas) {
      const ingredient_id = Number(d.ingredient_id)
      const qty_delta = Number(d.qty_delta)
      if (!Number.isFinite(qty_delta) || qty_delta === 0) continue

      await this._applyTransferIngredientLegs({
        transfer: next,
        ingredient_id,
        qty_delta,
        transfer_item_id: null,
        occurred_at,
        actor_user_id,
        source_type_in: 'transfer_in',
        source_type_out: 'transfer_out',
        from_origin_id: plan.from_origin_id,
        to_origin_id: plan.to_origin_id,
        organization_id: orgId,
      })
    }
  }

  async _applyTransferLegPlan({
    organization_id,
    transfer_id,
    from_origin_id,
    to_origin_id,
    items,
    sign,
    occurred_at,
    actor_user_id,
    source_type_in,
    source_type_out,
  }) {
    const list = Array.isArray(items) ? items : []
    for (const it of list) {
      const ingredient_id = Number(it.ingredient_id)
      const qty = Number(it.qty) * sign
      await this._applyTransferIngredientLegs({
        transfer: {
          id: transfer_id,
          organization_id,
          from_origin_id,
          to_origin_id,
        },
        ingredient_id,
        qty_delta: qty,
        transfer_item_id: Number(it.id) || null,
        occurred_at,
        actor_user_id,
        source_type_in,
        source_type_out,
        organization_id,
        from_origin_id,
        to_origin_id,
      })
    }
  }

  async _applyTransferIngredientLegs({
    transfer,
    ingredient_id,
    qty_delta,
    transfer_item_id,
    occurred_at,
    actor_user_id,
    source_type_in,
    source_type_out,
    organization_id: orgOverride,
    from_origin_id: fromOverride,
    to_origin_id: toOverride,
  }) {
    const orgId = orgOverride ?? Number(transfer.organization_id)
    const toOrigin = toOverride ?? transfer.to_origin_id
    const fromOrigin = fromOverride ?? transfer.from_origin_id
    const qty = Number(qty_delta)
    if (!Number.isFinite(qty) || qty === 0) return

    if (toOrigin) {
      const applied = await this.models.runningStock.applyDelta({
        organization_id: orgId,
        origin_id: Number(toOrigin),
        ingredient_id,
        qty_delta: +qty,
        occurred_at,
        created_by: actor_user_id,
      })
      events.emit(EventTypes.StockUpdated, {
        organization_id: orgId,
        origin_id: Number(toOrigin),
        ingredient_id,
        unit: applied.unit,
        qty_before: applied.qty_before,
        qty_delta: +qty,
        qty_after: applied.qty_after,
        source_type: source_type_in,
        source_transfer_id: Number(transfer.id),
        source_transfer_item_id: transfer_item_id,
        occurred_at,
        actor_user_id,
      })
    }

    if (fromOrigin) {
      const applied = await this.models.runningStock.applyDelta({
        organization_id: orgId,
        origin_id: Number(fromOrigin),
        ingredient_id,
        qty_delta: -qty,
        occurred_at,
        created_by: actor_user_id,
      })
      events.emit(EventTypes.StockUpdated, {
        organization_id: orgId,
        origin_id: Number(fromOrigin),
        ingredient_id,
        unit: applied.unit,
        qty_before: applied.qty_before,
        qty_delta: -qty,
        qty_after: applied.qty_after,
        source_type: source_type_out,
        source_transfer_id: Number(transfer.id),
        source_transfer_item_id: transfer_item_id,
        occurred_at,
        actor_user_id,
      })
    }
  }
}

module.exports = { StockService }

