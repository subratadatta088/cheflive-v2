const express = require('express')
const { authRouter } = require('./auth')
const { categoriesRouter } = require('./categories')
const { ingredientsRouter } = require('./ingredients')
const { originsRouter } = require('./origins')
const { preparationsRouter } = require('./preparations')
const { preparationItemsRouter } = require('./preparationItems')
const { unitConversionsRouter } = require('./unitConversions')
const { purchasesRouter } = require('./purchases')
const { purchaseItemsRouter } = require('./purchaseItems')

const router = express.Router()

router.use('/auth', authRouter)
router.use('/categories', categoriesRouter)
router.use('/ingredients', ingredientsRouter)
router.use('/origins', originsRouter)
router.use('/preparations', preparationsRouter)
router.use('/preparation-items', preparationItemsRouter)
router.use('/unit-conversions', unitConversionsRouter)
router.use('/purchases', purchasesRouter)
router.use('/purchase-items', purchaseItemsRouter)

module.exports = { v1Router: router }
