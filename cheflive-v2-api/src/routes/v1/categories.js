const express = require('express')
const { requireAuth } = require('../../middleware/auth')
const { withScopedModels } = require('../../middleware/rbacModels')
const { categoriesController } = require('../../controllers/categoriesController')

const router = express.Router()

router.use(requireAuth, withScopedModels)

router.post('/', categoriesController.createCategory)
router.get('/', categoriesController.listCategories)
router.get('/:id', categoriesController.getCategoryById)
router.patch('/:id', categoriesController.updateCategoryById)
router.delete('/:id', categoriesController.deleteCategoryById)

module.exports = { categoriesRouter: router }

