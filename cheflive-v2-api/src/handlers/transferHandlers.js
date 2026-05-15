const { StockService } = require('../services/stockService')
const { TransferService } = require('../services/transferService')

async function onTransferCreated(ctx) {
  const { models, payload } = ctx

  const transferService = new TransferService({
    models,
    user: { id: payload.actor_user_id ?? null, organization_id: payload.organization_id },
  })
  const stockService = new StockService({
    models,
    user: { id: payload.actor_user_id ?? null, organization_id: payload.organization_id },
  })

  const transfer = await transferService.getById(payload.transfer_id)
  if (!transfer) throw new Error('Transfer not found')
  if (transfer.deleted_at) return

  await stockService.applyTransfer(transfer)
}

async function onTransferUpdated(ctx) {
  const { models, payload } = ctx
  const previous = payload?.previous
  const next = payload?.next

  if (!previous || !next) return
  if (next.deleted_at) return

  const user = {
    id: payload.actor_user_id ?? null,
    organization_id: payload.organization_id,
  }

  const stockService = new StockService({ models, user })
  await stockService.applyTransferEditAdjustments(previous, next)
}

async function onTransferDeleted(ctx) {
  const { models, payload } = ctx
  const previous = payload?.previous
  if (!previous || previous.deleted_at) return

  const user = {
    id: payload.actor_user_id ?? null,
    organization_id: payload.organization_id,
  }

  const stockService = new StockService({ models, user })
  await stockService.revertTransfer(previous)
}

module.exports = { onTransferCreated, onTransferUpdated, onTransferDeleted }
