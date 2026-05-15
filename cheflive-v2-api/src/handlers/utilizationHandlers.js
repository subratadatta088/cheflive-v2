const { TransferService } = require('../services/transferService')
const { UtilizationService } = require('../services/utilizationService')

function utilizationTransferNote(utilizationId) {
  return `Auto transfer from utilization #${utilizationId}`
}

/**
 * Map utilization line items to nested transfer_items (1:1).
 * @param {any} utilization Utilization row with items from getById
 */
function mapUtilizationItemsToTransferItems(utilization) {
  const items = Array.isArray(utilization?.items) ? utilization.items : []
  const out = []

  for (const it of items) {
    const ingredient_id = Number(it.ingredient_id)
    const qty = Number(it.qty)
    const unit = it.unit != null ? String(it.unit).trim() : ''
    if (!Number.isFinite(ingredient_id) || ingredient_id <= 0) continue
    if (!Number.isFinite(qty) || qty <= 0) continue
    if (!unit) continue
    out.push({ ingredient_id, qty, unit })
  }

  return out
}

/**
 * @param {TransferService} transferService
 * @param {number} organization_id
 * @param {number} utilization_id
 */
async function findUtilizationLinkedTransfer(transferService, organization_id, utilization_id) {
  const transfers = await transferService.listByUtilisationId(organization_id, utilization_id)
  const uid = Number(utilization_id)
  const note = utilizationTransferNote(uid)

  return (
    transfers.find((t) => Number(t.to_utilisation_id) === uid) ||
    transfers.find((t) => String(t.note || '').trim() === note) ||
    transfers[0] ||
    null
  )
}

function utilizationTransferDate(utilization, fallback) {
  return utilization.date != null && String(utilization.date).trim() !== ''
    ? String(utilization.date).trim()
    : fallback || new Date().toISOString()
}

async function onUtilizationCreated(ctx) {
  const { models, payload } = ctx

  const user = {
    id: payload.actor_user_id ?? null,
    organization_id: payload.organization_id,
  }

  const utilizationService = new UtilizationService({ models, user })
  const transferService = new TransferService({ models, user })

  const utilization = await utilizationService.getById(payload.utilization_id)
  if (!utilization) throw new Error('Utilization not found')
  if (utilization.deleted_at) return

  const originId = Number(utilization.origin_id)
  if (!Number.isFinite(originId) || originId <= 0) throw new Error('Utilization origin_id is required')

  const transferItems = mapUtilizationItemsToTransferItems(utilization)
  const transferDate = utilizationTransferDate(utilization, payload.occurred_at)

  await transferService.create({
    organization_id: Number(utilization.organization_id),
    from_origin_id: originId,
    to_utilisation_id: Number(utilization.id),
    transfer_date: transferDate,
    note: utilizationTransferNote(utilization.id),
    items: transferItems.length ? transferItems : undefined,
  })
}

async function onUtilizationUpdated(ctx) {
  const { models, payload } = ctx
  const next = payload?.next
  if (!next || next.deleted_at) return

  const user = {
    id: payload.actor_user_id ?? null,
    organization_id: payload.organization_id,
  }

  const utilizationService = new UtilizationService({ models, user })
  const transferService = new TransferService({ models, user })

  const utilization = await utilizationService.getById(next.id)
  if (!utilization) throw new Error('Utilization not found')

  const originId = Number(utilization.origin_id)
  if (!Number.isFinite(originId) || originId <= 0) throw new Error('Utilization origin_id is required')

  const linked = await findUtilizationLinkedTransfer(
    transferService,
    Number(utilization.organization_id),
    utilization.id
  )
  if (!linked) return

  const transferItems = mapUtilizationItemsToTransferItems(utilization)
  const transferDate = utilizationTransferDate(utilization, payload.occurred_at)

  await transferService.updateById(linked.id, {
    from_origin_id: originId,
    transfer_date: transferDate,
    items: transferItems,
  })
}

async function onUtilizationDeleted(ctx) {
  const { models, payload } = ctx
  const previous = payload?.previous
  if (!previous || previous.deleted_at) return

  const user = {
    id: payload.actor_user_id ?? null,
    organization_id: payload.organization_id,
  }

  const transferService = new TransferService({ models, user })
  const linked = await findUtilizationLinkedTransfer(
    transferService,
    Number(previous.organization_id),
    previous.id
  )

  if (linked) await transferService.deleteById(linked.id)
}

module.exports = {
  onUtilizationCreated,
  onUtilizationUpdated,
  onUtilizationDeleted,
  mapUtilizationItemsToTransferItems,
  findUtilizationLinkedTransfer,
}
