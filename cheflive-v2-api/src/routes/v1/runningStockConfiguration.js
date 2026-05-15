const express = require('express')
const { requireAuth } = require('../../middleware/auth')
const { withScopedModels } = require('../../middleware/rbacModels')
const { RunningStockConfigurationController } = require('../../controllers/runningStockConfigurationController')

const router = express.Router()

router.use(requireAuth, withScopedModels)

const controller = new RunningStockConfigurationController()

router.get('/', controller.getConfiguration)
router.post('/', controller.upsertConfiguration)
router.patch('/', controller.upsertConfiguration)

module.exports = { runningStockConfigurationRouter: router }
