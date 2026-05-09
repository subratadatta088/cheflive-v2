const { events, EventTypes } = require('../events')

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

      if (t.to_origin_id) {
        const applied = await this.models.runningStock.applyDelta({
          organization_id: Number(t.organization_id),
          origin_id: Number(t.to_origin_id),
          ingredient_id,
          qty_delta: +qty,
          occurred_at,
          created_by: actor_user_id,
        })
        events.emit(EventTypes.StockUpdated, {
          organization_id: Number(t.organization_id),
          origin_id: Number(t.to_origin_id),
          ingredient_id,
          unit: applied.unit,
          qty_before: applied.qty_before,
          qty_delta: +qty,
          qty_after: applied.qty_after,
          source_type: 'transfer_in',
          source_transfer_id: Number(t.id),
          source_transfer_item_id: Number(it.id) || null,
          occurred_at,
          actor_user_id,
        })
      }

      if (t.from_origin_id) {
        const applied = await this.models.runningStock.applyDelta({
          organization_id: Number(t.organization_id),
          origin_id: Number(t.from_origin_id),
          ingredient_id,
          qty_delta: -qty,
          occurred_at,
          created_by: actor_user_id,
        })
        events.emit(EventTypes.StockUpdated, {
          organization_id: Number(t.organization_id),
          origin_id: Number(t.from_origin_id),
          ingredient_id,
          unit: applied.unit,
          qty_before: applied.qty_before,
          qty_delta: -qty,
          qty_after: applied.qty_after,
          source_type: 'transfer_out',
          source_transfer_id: Number(t.id),
          source_transfer_item_id: Number(it.id) || null,
          occurred_at,
          actor_user_id,
        })
      }
    }
  }
}

module.exports = { StockService }

