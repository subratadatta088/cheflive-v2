const express = require('express')
const { requireAuth } = require('../../middleware/auth')
const { withScopedModels } = require('../../middleware/rbacModels')
const {
  PurchaseItemCreateSchema,
  PurchaseItemIdSchema,
  PurchaseItemListQuerySchema,
  PurchaseItemUpdateSchema,
} = require('../../models/purchaseItem/schema')

const router = express.Router()

router.use(requireAuth, withScopedModels)

function isSuperAdmin(req) {
  return Array.isArray(req.user?.roles) && req.user.roles.includes('superadmin')
}

router.post('/', async (req, res) => {
  const body = { ...req.body }

  if (isSuperAdmin(req)) {
    if (!body.organization_id)
      return res.status(400).json({ error: 'organization_id is required' })
  } else {
    body.organization_id = req.user.organization_id
  }

  const parsed = PurchaseItemCreateSchema.safeParse(body)
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' })

  try {
    const created = await req.models.purchaseItem.create(parsed.data)
    return res.json({ purchase_item: created })
  } catch (e) {
    const msg = String(e?.message || '')
    if (msg.includes('Purchase not found')) return res.status(400).json({ error: 'Purchase not found' })
    if (msg.includes('Purchase organization mismatch'))
      return res.status(400).json({ error: 'Purchase organization mismatch' })
    if (msg.includes('Ingredient not found')) return res.status(400).json({ error: 'Ingredient not found' })
    if (msg.includes('Ingredient organization mismatch'))
      return res.status(400).json({ error: 'Ingredient organization mismatch' })
    throw e
  }
})

router.get('/', async (req, res) => {
  const parsed = PurchaseItemListQuerySchema.safeParse(req.query)
  if (!parsed.success) return res.status(400).json({ error: 'Invalid query' })

  const query = { ...parsed.data }

  if (isSuperAdmin(req)) {
    if (!query.organization_id)
      return res.status(400).json({ error: 'organization_id is required' })
  } else {
    query.organization_id = req.user.organization_id
  }

  const items = await req.models.purchaseItem.list(query)
  return res.json({
    page: query.page,
    limit: query.limit,
    items,
  })
})

router.get('/:id', async (req, res) => {
  const idParsed = PurchaseItemIdSchema.safeParse(Number(req.params.id))
  if (!idParsed.success) return res.status(400).json({ error: 'Invalid id' })

  const item = await req.models.purchaseItem.getById(idParsed.data)
  if (!item) return res.status(404).json({ error: 'Not found' })
  return res.json({ purchase_item: item })
})

router.patch('/:id', async (req, res) => {
  const idParsed = PurchaseItemIdSchema.safeParse(Number(req.params.id))
  if (!idParsed.success) return res.status(400).json({ error: 'Invalid id' })

  const bodyParsed = PurchaseItemUpdateSchema.safeParse(req.body)
  if (!bodyParsed.success) return res.status(400).json({ error: 'Invalid payload' })

  const updated = await req.models.purchaseItem.updateById(idParsed.data, bodyParsed.data)
  if (!updated) return res.status(404).json({ error: 'Not found' })
  return res.json({ purchase_item: updated })
})

router.delete('/:id', async (req, res) => {
  const idParsed = PurchaseItemIdSchema.safeParse(Number(req.params.id))
  if (!idParsed.success) return res.status(400).json({ error: 'Invalid id' })

  const ok = await req.models.purchaseItem.deleteById(idParsed.data)
  return res.json({ ok: Boolean(ok) })
})

module.exports = { purchaseItemsRouter: router }
