const {
  CategoryCreateSchema,
  CategoryIdSchema,
  CategoryListQuerySchema,
  CategoryUpdateSchema,
} = require('../models/category/schema')

class CategoriesController {
  constructor() {
    this.createCategory = this.createCategory.bind(this)
    this.listCategories = this.listCategories.bind(this)
    this.getCategoryById = this.getCategoryById.bind(this)
    this.updateCategoryById = this.updateCategoryById.bind(this)
    this.deleteCategoryById = this.deleteCategoryById.bind(this)
  }

  _isSuperAdmin(req) {
    return Array.isArray(req.user?.roles) && req.user.roles.includes('superadmin')
  }

  async createCategory(req, res) {
    const body = { ...req.body }

    if (this._isSuperAdmin(req)) {
      if (!body.organization_id) return res.status(400).json({ error: 'organization_id is required' })
    } else {
      body.organization_id = req.user.organization_id
    }

    const parsed = CategoryCreateSchema.safeParse(body)
    if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' })
    const created = await req.models.category.create(parsed.data)
    return res.json({ category: created })
  }

  async listCategories(req, res) {
    const query = { ...req.query }

    if (this._isSuperAdmin(req)) {
      if (!query.organization_id) return res.status(400).json({ error: 'organization_id is required' })
    } else {
      query.organization_id = req.user.organization_id
      query.deleted_at = null
    }

    const parsed = CategoryListQuerySchema.safeParse(query)
    if (!parsed.success) return res.status(400).json({ error: 'Invalid query' })
    const items = await req.models.category.list(parsed.data)
    return res.json({ page: parsed.data.page, limit: parsed.data.limit, items })
  }

  async getCategoryById(req, res) {
    const idParsed = CategoryIdSchema.safeParse(Number(req.params.id))
    if (!idParsed.success) return res.status(400).json({ error: 'Invalid id' })
    const item = await req.models.category.getById(idParsed.data)
    if (!item) return res.status(404).json({ error: 'Not found' })
    return res.json({ category: item })
  }

  async updateCategoryById(req, res) {
    const idParsed = CategoryIdSchema.safeParse(Number(req.params.id))
    if (!idParsed.success) return res.status(400).json({ error: 'Invalid id' })

    const body = { ...req.body }
    if (!this._isSuperAdmin(req)) delete body.organization_id

    const bodyParsed = CategoryUpdateSchema.safeParse(body)
    if (!bodyParsed.success) return res.status(400).json({ error: 'Invalid payload' })
    const updated = await req.models.category.updateById(idParsed.data, bodyParsed.data)
    if (!updated) return res.status(404).json({ error: 'Not found' })
    return res.json({ category: updated })
  }

  async deleteCategoryById(req, res) {
    const idParsed = CategoryIdSchema.safeParse(Number(req.params.id))
    if (!idParsed.success) return res.status(400).json({ error: 'Invalid id' })
    const ok = await req.models.category.deleteById(idParsed.data)
    return res.json({ ok: Boolean(ok) })
  }
}

const categoriesController = new CategoriesController()

module.exports = { CategoriesController, categoriesController }

