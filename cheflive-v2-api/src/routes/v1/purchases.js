const express = require('express')
const { requireAuth } = require('../../middleware/auth')
const { withScopedModels } = require('../../middleware/rbacModels')
const {
  PurchaseCreateSchema,
  PurchaseIdSchema,
  PurchaseListQuerySchema,
  PurchaseUpdateSchema,
} = require('../../models/purchase/schema')

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

  const parsed = PurchaseCreateSchema.safeParse(body)
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' })

  try {
    const created = await req.models.purchase.create(parsed.data)
    return res.json({ purchase: created })
  } catch (e) {
    const msg = String(e?.message || '')
    if (msg.includes('Origin not found')) return res.status(400).json({ error: 'Origin not found' })
    if (msg.includes('Origin organization mismatch'))
      return res.status(400).json({ error: 'Origin organization mismatch' })
    if (msg.includes('Ingredient organization mismatch'))
      return res.status(400).json({ error: 'Ingredient organization mismatch' })
    throw e
  }
})

router.get('/', async (req, res) => {
  const parsed = PurchaseListQuerySchema.safeParse(req.query)
  if (!parsed.success) return res.status(400).json({ error: 'Invalid query' })

  const query = { ...parsed.data }

  if (isSuperAdmin(req)) {
    if (!query.organization_id)
      return res.status(400).json({ error: 'organization_id is required' })
  } else {
    query.organization_id = req.user.organization_id
  }

  const items = await req.models.purchase.list(query)
  return res.json({
    page: query.page,
    limit: query.limit,
    items,
  })
})

router.get('/:id', async (req, res) => {
  const idParsed = PurchaseIdSchema.safeParse(Number(req.params.id))
  if (!idParsed.success) return res.status(400).json({ error: 'Invalid id' })

  const item = await req.models.purchase.getById(idParsed.data)
  if (!item) return res.status(404).json({ error: 'Not found' })
  return res.json({ purchase: item })
})

router.patch('/:id', async (req, res) => {
  const idParsed = PurchaseIdSchema.safeParse(Number(req.params.id))
  if (!idParsed.success) return res.status(400).json({ error: 'Invalid id' })

  const bodyParsed = PurchaseUpdateSchema.safeParse(req.body)
  if (!bodyParsed.success) return res.status(400).json({ error: 'Invalid payload' })

  try {
    const updated = await req.models.purchase.updateById(idParsed.data, bodyParsed.data)
    if (!updated) return res.status(404).json({ error: 'Not found' })
    return res.json({ purchase: updated })
  } catch (e) {
    const msg = String(e?.message || '')
    if (msg.includes('Origin not found')) return res.status(400).json({ error: 'Origin not found' })
    if (msg.includes('Origin organization mismatch'))
      return res.status(400).json({ error: 'Origin organization mismatch' })
    throw e
  }
})

router.delete('/:id', async (req, res) => {
  const idParsed = PurchaseIdSchema.safeParse(Number(req.params.id))
  if (!idParsed.success) return res.status(400).json({ error: 'Invalid id' })

  const ok = await req.models.purchase.deleteById(idParsed.data)
  return res.json({ ok: Boolean(ok) })
})

module.exports = { purchasesRouter: router }
