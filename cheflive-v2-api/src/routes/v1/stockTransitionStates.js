const express = require('express')
const { requireAuth } = require('../../middleware/auth')
const { withScopedModels } = require('../../middleware/rbacModels')
const { StockTransitionStatesController } = require('../../controllers/stockTransitionStatesController')

const router = express.Router()

router.use(requireAuth, withScopedModels)

const controller = new StockTransitionStatesController()

router.get('/', controller.list)
router.get('/:id', controller.getById)

module.exports = { stockTransitionsRouter: router }

