const { PurchaseService } = require('../services/purchaseService')
const { TransferService } = require('../services/transferService')

async function convertPurchaseItemsToTransferItems(models, purchase) {
  const items = Array.isArray(purchase.items) ? purchase.items : []
  const out = []

  for (const it of items) {
    const ingredient = await models.ingredient.getById(Number(it.ingredient_id))
    if (!ingredient) throw new Error('Ingredient not found')

    const defaultUnit = String(ingredient.unit || '').trim()
    if (!defaultUnit) throw new Error('Ingredient default unit is missing')

    const qty = Number(it.qty)
    if (!Number.isFinite(qty)) throw new Error('Invalid qty')

    // purchase_items.unit is TEXT; if it differs from ingredient default unit, convert.
    const fromUnit = it.unit ? String(it.unit).trim() : ''
    let qtyDefault = qty
    if (fromUnit && fromUnit !== defaultUnit) {
      const convs = await models.ingredient.getById(Number(it.ingredient_id))
      const conversions = Array.isArray(convs?.unit_conversions) ? convs.unit_conversions : []
      const match = conversions.find((c) => c.from_unit === fromUnit && c.to_unit === defaultUnit)
      if (!match) throw new Error('Unit conversion not found')
      qtyDefault = qty * Number(match.factor)
    }

    out.push({
      ingredient_id: Number(it.ingredient_id),
      qty: qtyDefault,
      unit: defaultUnit,
    })
  }

  return out
}

async function onPurchaseCreated(ctx) {
  const { models, payload } = ctx

  const purchaseService = new PurchaseService({
    models,
    user: { id: payload.actor_user_id ?? null, organization_id: payload.organization_id },
  })
  const transferService = new TransferService({
    models,
    user: { id: payload.actor_user_id ?? null, organization_id: payload.organization_id },
  })

  const purchase = await purchaseService.getById(payload.purchase_id)
  if (!purchase) throw new Error('Purchase not found')
  if (purchase.deleted_at) return

  // Create a transfer representing purchase -> origin stock-in.
  const transferItems = await convertPurchaseItemsToTransferItems(models, purchase)

  await transferService.create({
    organization_id: purchase.organization_id,
    from_purchase_id: purchase.id,
    to_origin_id: purchase.origin_id,
    transfer_date: purchase.date,
    note: `Auto transfer from purchase #${purchase.id}`,
    items: transferItems,
  })

  const transferToRaw = payload.transfer_to
  if (transferToRaw !== undefined && transferToRaw !== null) {
    const transferTo = Number(transferToRaw)
    if (!Number.isFinite(transferTo) || transferTo <= 0) throw new Error('Invalid transfer_to')
    if (transferTo === Number(purchase.origin_id)) throw new Error('transfer_to must differ from origin_id')

    await transferService.create({
      organization_id: purchase.organization_id,
      from_origin_id: purchase.origin_id,
      to_origin_id: transferTo,
      transfer_date: purchase.date,
      note: `Auto transfer after purchase #${purchase.id}`,
      items: transferItems,
    })
  }
}

// For now, updates/deletes are handled by emitting TransferEntry* from the service layer.
// Purchase update/delete can be implemented by creating compensating transfers or by
// editing the auto transfer once we persist linkage.
async function onPurchaseUpdated(_ctx) {}
async function onPurchaseDeleted(_ctx) {}

module.exports = { onPurchaseCreated, onPurchaseUpdated, onPurchaseDeleted }

