const express = require('express')
const { requireAuth } = require('../../middleware/auth')
const { withScopedModels } = require('../../middleware/rbacModels')
const { TransfersController } = require('../../controllers/transfersController')

const router = express.Router()

router.use(requireAuth, withScopedModels)

const controller = new TransfersController()

router.post('/', controller.create)
router.get('/', controller.list)
router.get('/:id', controller.getById)
router.patch('/:id', controller.updateById)
router.delete('/:id', controller.deleteById)

module.exports = { transfersRouter: router }

