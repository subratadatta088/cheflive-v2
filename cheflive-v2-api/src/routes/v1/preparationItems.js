const express = require('express')
const { requireAuth } = require('../../middleware/auth')
const { withScopedModels } = require('../../middleware/rbacModels')
const {
  PreparationItemCreateSchema,
  PreparationItemIdSchema,
  PreparationItemListQuerySchema,
  PreparationItemUpdateSchema,
} = require('../../models/preparationItem/schema')

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

  const parsed = PreparationItemCreateSchema.safeParse(body)
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' })

  const created = await req.models.preparationItem.create(parsed.data)
  return res.json({ preparation_item: created })
})

router.get('/', async (req, res) => {
  const parsed = PreparationItemListQuerySchema.safeParse(req.query)
  if (!parsed.success) return res.status(400).json({ error: 'Invalid query' })

  const query = { ...parsed.data }

  if (isSuperAdmin(req)) {
    if (!query.organization_id)
      return res.status(400).json({ error: 'organization_id is required' })
  } else {
    query.organization_id = req.user.organization_id
  }

  const items = await req.models.preparationItem.list(query)
  return res.json({
    page: query.page,
    limit: query.limit,
    items,
  })
})

router.get('/:id', async (req, res) => {
  const idParsed = PreparationItemIdSchema.safeParse(Number(req.params.id))
  if (!idParsed.success) return res.status(400).json({ error: 'Invalid id' })

  const item = await req.models.preparationItem.getById(idParsed.data)
  if (!item) return res.status(404).json({ error: 'Not found' })
  return res.json({ preparation_item: item })
})

router.patch('/:id', async (req, res) => {
  const idParsed = PreparationItemIdSchema.safeParse(Number(req.params.id))
  if (!idParsed.success) return res.status(400).json({ error: 'Invalid id' })

  const bodyParsed = PreparationItemUpdateSchema.safeParse(req.body)
  if (!bodyParsed.success) return res.status(400).json({ error: 'Invalid payload' })

  const updated = await req.models.preparationItem.updateById(idParsed.data, bodyParsed.data)
  if (!updated) return res.status(404).json({ error: 'Not found' })
  return res.json({ preparation_item: updated })
})

router.delete('/:id', async (req, res) => {
  const idParsed = PreparationItemIdSchema.safeParse(Number(req.params.id))
  if (!idParsed.success) return res.status(400).json({ error: 'Invalid id' })

  const ok = await req.models.preparationItem.deleteById(idParsed.data)
  return res.json({ ok: Boolean(ok) })
})

module.exports = { preparationItemsRouter: router }

