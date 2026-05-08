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

async function onTransferUpdated(_ctx) {}
async function onTransferDeleted(_ctx) {}

module.exports = { onTransferCreated, onTransferUpdated, onTransferDeleted }

