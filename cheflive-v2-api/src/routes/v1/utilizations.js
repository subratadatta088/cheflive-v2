const express = require('express')
const { requireAuth } = require('../../middleware/auth')
const { withScopedModels } = require('../../middleware/rbacModels')
const { UtilizationsController } = require('../../controllers/utilizationsController')

const router = express.Router()

router.use(requireAuth, withScopedModels)

const controller = new UtilizationsController()

router.post('/', controller.create)

router.post('/grouped-items', controller.groupItemsByIngredient)
router.post('/all-items', controller.getAllItems)

router.get('/', controller.list)
router.get('/:id', controller.getById)
router.patch('/:id', controller.updateById)
router.delete('/:id', controller.deleteById)

module.exports = { utilizationsRouter: router }
