const express = require('express')
const { requireAuth } = require('../../middleware/auth')
const { withScopedModels } = require('../../middleware/rbacModels')
const { ingredientsController } = require('../../controllers/ingredientsController')

const router = express.Router()

router.use(requireAuth, withScopedModels)

router.post('/bulk-upload', ingredientsController.bulkUploadIngredients)
router.post('/bulk', ingredientsController.bulkCreateIngredients)
router.put('/bulk', ingredientsController.bulkUpdateIngredients)
router.post('/', ingredientsController.createIngredient)
router.get('/', ingredientsController.listIngredients)
router.get('/:id', ingredientsController.getIngredientById)
router.patch('/:id', ingredientsController.updateIngredientById)
router.delete('/:id', ingredientsController.deleteIngredientById)

module.exports = { ingredientsRouter: router }

