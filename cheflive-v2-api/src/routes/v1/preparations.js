const express = require('express')
const { requireAuth } = require('../../middleware/auth')
const { withScopedModels } = require('../../middleware/rbacModels')
const { PreparationsController } = require('../../controllers/preparationsController')

const router = express.Router()
const controller = new PreparationsController()

router.use(requireAuth, withScopedModels)

router.post('/', controller.create)
router.get('/', controller.list)
router.get('/:id', controller.getById)
router.patch('/:id', controller.updateById)
router.delete('/:id', controller.deleteById)

module.exports = { preparationsRouter: router }
