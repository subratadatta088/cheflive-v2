const express = require('express')
const { requireAuth } = require('../../middleware/auth')
const { withScopedModels } = require('../../middleware/rbacModels')
const { originsController } = require('../../controllers/originsController')

const router = express.Router()

router.use(requireAuth, withScopedModels)

router.post('/', originsController.createOrigin)
router.get('/', originsController.listOrigins)
router.get('/:id', originsController.getOriginById)
router.patch('/:id', originsController.updateOriginById)
router.delete('/:id', originsController.deleteOriginById)

module.exports = { originsRouter: router }

