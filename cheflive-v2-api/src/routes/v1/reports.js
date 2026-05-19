const express = require('express')
const { requireAuth } = require('../../middleware/auth')
const { withScopedModels } = require('../../middleware/rbacModels')
const { PurchaseReportsController } = require('../../controllers/purchaseReportsController')

const router = express.Router()

router.use(requireAuth, withScopedModels)

const controller = new PurchaseReportsController()

router.post('/purchase-analytics', controller.purchaseAnalytics)
router.post('/purchase-timeline', controller.purchaseTimeline)

module.exports = { reportsRouter: router }
