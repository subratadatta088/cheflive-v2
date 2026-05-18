const express = require('express')
const { requireAuth } = require('../../middleware/auth')
const { withScopedModels } = require('../../middleware/rbacModels')
const { StockController } = require('../../controllers/stockController')

const router = express.Router()

router.use(requireAuth, withScopedModels)

const controller = new StockController()

router.get('/', controller.list)

module.exports = { stocksRouter: router }
