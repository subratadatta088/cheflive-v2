const { StockTransitionService } = require('../services/stockTransitionService')

async function onStockUpdated(ctx) {
  const { models, payload } = ctx
  const service = new StockTransitionService({
    models,
    user: { id: payload.actor_user_id ?? null, organization_id: payload.organization_id },
  })

  await service.create({
    organization_id: payload.organization_id,
    origin_id: payload.origin_id,
    ingredient_id: payload.ingredient_id,
    unit: payload.unit,
    qty_before: payload.qty_before,
    qty_delta: payload.qty_delta,
    qty_after: payload.qty_after,
    source_type: payload.source_type,
    source_transfer_id: payload.source_transfer_id ?? null,
    source_transfer_item_id: payload.source_transfer_item_id ?? null,
    source_purchase_id: payload.source_purchase_id ?? null,
    source_purchase_item_id: payload.source_purchase_item_id ?? null,
    occurred_at: payload.occurred_at,
    created_by: payload.actor_user_id ?? null,
  })
}

module.exports = { onStockUpdated }

