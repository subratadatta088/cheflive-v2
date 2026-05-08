const express = require('express')
const { requireAuth } = require('../../middleware/auth')
const { withScopedModels } = require('../../middleware/rbacModels')
const { RunningStockController } = require('../../controllers/runningStockController')

const router = express.Router()

router.use(requireAuth, withScopedModels)

const controller = new RunningStockController()

router.get('/', controller.list)
router.get('/:id', controller.getById)

module.exports = { runningStockRouter: router }

