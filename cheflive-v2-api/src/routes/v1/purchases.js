const express = require('express')
const { requireAuth } = require('../../middleware/auth')
const { withScopedModels } = require('../../middleware/rbacModels')
const { PurchasesController } = require('../../controllers/purchasesController')

const router = express.Router()

router.use(requireAuth, withScopedModels)

const controller = new PurchasesController()

router.post('/', controller.create)

router.post('/grouped-items', controller.groupItemsByIngredient)

router.get('/low-stock-items', controller.getItemsByLowStock)

router.get('/', controller.list)

router.get('/:id', controller.getById)

router.patch('/:id', controller.updateById)

router.delete('/:id', controller.deleteById)

module.exports = { purchasesRouter: router }
