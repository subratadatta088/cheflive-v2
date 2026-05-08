const { z } = require('zod')
const {
  getCategoryModel,
  getIngredientModel,
  getOriginModel,
  getPreparationModel,
  getPreparationItemModel,
  getPurchaseItemModel,
  getPurchaseModel,
  getRunningStockModel,
  getStockTransitionStateModel,
  getTransferItemModel,
  getTransferModel,
  getUnitConversionModel,
  getUserModel,
} = require('../drivers/factory')

const RolesSchema = z.array(z.enum(['superadmin', 'admin', 'member']))

function forbidden(res) {
  return res.status(403).json({ error: 403, message: 'You are not authorized to access this resource' })
}

function withScopedModels(req, res, next) {
  const rolesParsed = RolesSchema.safeParse(req.user?.roles)
  if (!rolesParsed.success) return forbidden(res)
  const roles = rolesParsed.data

  const userDal = getUserModel()
  const categoryDal = getCategoryModel()
  const ingredientDal = getIngredientModel()
  const originDal = getOriginModel()
  const preparationDal = getPreparationModel()
  const preparationItemDal = getPreparationItemModel()
  const unitConversionDal = getUnitConversionModel()
  const purchaseDal = getPurchaseModel()
  const purchaseItemDal = getPurchaseItemModel()
  const transferDal = getTransferModel()
  const transferItemDal = getTransferItemModel()
  const runningStockDal = getRunningStockModel()
  const stockTransitionStateDal = getStockTransitionStateModel()

  if (roles.includes('superadmin')) {
    req.models = {
      user: userDal,
      category: categoryDal,
      ingredient: ingredientDal,
      origin: originDal,
      preparation: preparationDal,
      preparationItem: preparationItemDal,
      unitConversion: unitConversionDal,
      purchase: purchaseDal,
      purchaseItem: purchaseItemDal,
      transfer: transferDal,
      transferItem: transferItemDal,
      runningStock: runningStockDal,
      stockTransitionState: stockTransitionStateDal,
    }
    return next()
  }

  if (roles.includes('admin')) {
    if (!req.user.organization_id) return forbidden(res)
    req.models = {
      user: {
        create: async (data) => {
          if (data?.organization_id !== req.user.organization_id) return forbidden(res)
          return await userDal.create(data)
        },
        getById: async (id) => {
          const row = await userDal.getById(id)
          if (!row) return null
          if (row.organization_id !== req.user.organization_id) return forbidden(res)
          return row
        },
        getAll: async () => {
          const rows = await userDal.getAll()
          return rows.filter((r) => r.organization_id === req.user.organization_id)
        },
        updateById: async (id, data) => {
          const existing = await userDal.getById(id)
          if (!existing) return null
          if (existing.organization_id !== req.user.organization_id) return forbidden(res)
          if (data?.organization_id !== undefined && data.organization_id !== req.user.organization_id)
            return forbidden(res)
          return await userDal.updateById(id, data)
        },
        deleteById: async (id) => {
          const existing = await userDal.getById(id)
          if (!existing) return false
          if (existing.organization_id !== req.user.organization_id) return forbidden(res)
          return await userDal.deleteById(id)
        },
      },
      category: {
        create: async (data) => {
          if (data?.organization_id !== req.user.organization_id) return forbidden(res)
          return await categoryDal.create(data)
        },
        getById: async (id) => {
          const row = await categoryDal.getById(id)
          if (!row) return null
          if (row.organization_id !== req.user.organization_id) return forbidden(res)
          return row
        },
        list: async (query) => {
          return await categoryDal.list({ ...query, organization_id: req.user.organization_id })
        },
        updateById: async (id, data) => {
          const existing = await categoryDal.getById(id)
          if (!existing) return null
          if (existing.organization_id !== req.user.organization_id) return forbidden(res)
          if (data?.organization_id !== undefined && data.organization_id !== req.user.organization_id)
            return forbidden(res)
          return await categoryDal.updateById(id, data)
        },
        deleteById: async (id) => {
          const existing = await categoryDal.getById(id)
          if (!existing) return false
          if (existing.organization_id !== req.user.organization_id) return forbidden(res)
          return await categoryDal.deleteById(id)
        },
      },
      ingredient: {
        create: async (data) => {
          if (data?.organization_id !== req.user.organization_id) return forbidden(res)
          return await ingredientDal.create(data)
        },
        listNamesByOrganization: async (organization_id) => {
          if (organization_id !== req.user.organization_id) return forbidden(res)
          return await ingredientDal.listNamesByOrganization(organization_id)
        },
        bulkCreate: async (items) => {
          const inputs = Array.isArray(items) ? items : []
          for (const it of inputs) {
            if (it?.organization_id !== req.user.organization_id) return forbidden(res)
          }
          return await ingredientDal.bulkCreate(inputs)
        },
        bulkUpdate: async (items) => {
          const inputs = Array.isArray(items) ? items : []
          for (const it of inputs) {
            const id = Number(it?.id)
            if (!Number.isFinite(id)) return forbidden(res)
            const existing = await ingredientDal.getById(id)
            if (!existing) return forbidden(res)
            if (existing.organization_id !== req.user.organization_id) return forbidden(res)
          }
          return await ingredientDal.bulkUpdate(inputs)
        },
        getByItemCode: async ({ organization_id, item_code }) => {
          if (organization_id !== req.user.organization_id) return forbidden(res)
          return await ingredientDal.getByItemCode({ organization_id, item_code })
        },
        getById: async (id) => {
          const row = await ingredientDal.getById(id)
          if (!row) return null
          if (row.organization_id !== req.user.organization_id) return forbidden(res)
          return row
        },
        list: async (query) => {
          return await ingredientDal.list({ ...query, organization_id: req.user.organization_id })
        },
        updateById: async (id, data) => {
          const existing = await ingredientDal.getById(id)
          if (!existing) return null
          if (existing.organization_id !== req.user.organization_id) return forbidden(res)
          if (data?.organization_id !== undefined && data.organization_id !== req.user.organization_id)
            return forbidden(res)
          return await ingredientDal.updateById(id, data)
        },
        deleteById: async (id) => {
          const existing = await ingredientDal.getById(id)
          if (!existing) return false
          if (existing.organization_id !== req.user.organization_id) return forbidden(res)
          return await ingredientDal.deleteById(id)
        },
      },
      origin: {
        create: async (data) => {
          if (data?.organization_id !== req.user.organization_id) return forbidden(res)
          return await originDal.create(data)
        },
        getById: async (id) => {
          const row = await originDal.getById(id)
          if (!row) return null
          if (row.organization_id !== req.user.organization_id) return forbidden(res)
          return row
        },
        list: async (query) => {
          return await originDal.list({ ...query, organization_id: req.user.organization_id })
        },
        updateById: async (id, data) => {
          const existing = await originDal.getById(id)
          if (!existing) return null
          if (existing.organization_id !== req.user.organization_id) return forbidden(res)
          if (data?.organization_id !== undefined && data.organization_id !== req.user.organization_id)
            return forbidden(res)
          return await originDal.updateById(id, data)
        },
        deleteById: async (id) => {
          const existing = await originDal.getById(id)
          if (!existing) return false
          if (existing.organization_id !== req.user.organization_id) return forbidden(res)
          return await originDal.deleteById(id)
        },
      },
      preparation: {
        create: async (data) => {
          if (data?.organization_id !== req.user.organization_id) return forbidden(res)
          return await preparationDal.create(data)
        },
        getById: async (id) => {
          const row = await preparationDal.getById(id)
          if (!row) return null
          if (row.organization_id !== req.user.organization_id) return forbidden(res)
          return row
        },
        list: async (query) => {
          return await preparationDal.list({ ...query, organization_id: req.user.organization_id })
        },
        updateById: async (id, data) => {
          const existing = await preparationDal.getById(id)
          if (!existing) return null
          if (existing.organization_id !== req.user.organization_id) return forbidden(res)
          if (data?.organization_id !== undefined && data.organization_id !== req.user.organization_id)
            return forbidden(res)
          return await preparationDal.updateById(id, data)
        },
        deleteById: async (id) => {
          const existing = await preparationDal.getById(id)
          if (!existing) return false
          if (existing.organization_id !== req.user.organization_id) return forbidden(res)
          return await preparationDal.deleteById(id)
        },
      },
      preparationItem: {
        create: async (data) => {
          if (data?.organization_id !== req.user.organization_id) return forbidden(res)
          return await preparationItemDal.create(data)
        },
        getById: async (id) => {
          const row = await preparationItemDal.getById(id)
          if (!row) return null
          if (row.organization_id !== req.user.organization_id) return forbidden(res)
          return row
        },
        list: async (query) => {
          return await preparationItemDal.list({
            ...query,
            organization_id: req.user.organization_id,
          })
        },
        updateById: async (id, data) => {
          const existing = await preparationItemDal.getById(id)
          if (!existing) return null
          if (existing.organization_id !== req.user.organization_id) return forbidden(res)
          return await preparationItemDal.updateById(id, data)
        },
        deleteById: async (id) => {
          const existing = await preparationItemDal.getById(id)
          if (!existing) return false
          if (existing.organization_id !== req.user.organization_id) return forbidden(res)
          return await preparationItemDal.deleteById(id)
        },
      },
      unitConversion: {
        create: async (data) => {
          if (data?.organization_id !== req.user.organization_id) return forbidden(res)
          return await unitConversionDal.create(data)
        },
        bulkCreate: async (items) => {
          const inputs = Array.isArray(items) ? items : []
          for (const it of inputs) {
            if (it?.organization_id !== req.user.organization_id) return forbidden(res)
          }
          return await unitConversionDal.bulkCreate(inputs)
        },
        getById: async (id) => {
          const row = await unitConversionDal.getById(id)
          if (!row) return null
          if (row.organization_id !== req.user.organization_id) return forbidden(res)
          return row
        },
        list: async (query) => {
          return await unitConversionDal.list({
            ...query,
            organization_id: req.user.organization_id,
          })
        },
        updateById: async (id, data) => {
          const existing = await unitConversionDal.getById(id)
          if (!existing) return null
          if (existing.organization_id !== req.user.organization_id) return forbidden(res)
          return await unitConversionDal.updateById(id, data)
        },
        bulkUpdate: async (items) => {
          const inputs = Array.isArray(items) ? items : []
          for (const it of inputs) {
            const id = Number(it?.id)
            if (!Number.isFinite(id)) return forbidden(res)
            const existing = await unitConversionDal.getById(id)
            if (!existing) return forbidden(res)
            if (existing.organization_id !== req.user.organization_id) return forbidden(res)
          }
          return await unitConversionDal.bulkUpdate(inputs)
        },
        deleteById: async (id) => {
          const existing = await unitConversionDal.getById(id)
          if (!existing) return false
          if (existing.organization_id !== req.user.organization_id) return forbidden(res)
          return await unitConversionDal.deleteById(id)
        },
      },
      purchase: {
        create: async (data) => {
          if (data?.organization_id !== req.user.organization_id) return forbidden(res)
          return await purchaseDal.create(data)
        },
        getById: async (id) => {
          const row = await purchaseDal.getById(id)
          if (!row) return null
          if (row.organization_id !== req.user.organization_id) return forbidden(res)
          return row
        },
        list: async (query) => {
          return await purchaseDal.list({ ...query, organization_id: req.user.organization_id })
        },
        updateById: async (id, data) => {
          const existing = await purchaseDal.getById(id)
          if (!existing) return null
          if (existing.organization_id !== req.user.organization_id) return forbidden(res)
          if (data?.organization_id !== undefined && data.organization_id !== req.user.organization_id)
            return forbidden(res)
          return await purchaseDal.updateById(id, data)
        },
        deleteById: async (id) => {
          const existing = await purchaseDal.getById(id)
          if (!existing) return false
          if (existing.organization_id !== req.user.organization_id) return forbidden(res)
          return await purchaseDal.deleteById(id)
        },
      },
      purchaseItem: {
        create: async (data) => {
          if (data?.organization_id !== req.user.organization_id) return forbidden(res)
          return await purchaseItemDal.create(data)
        },
        getById: async (id) => {
          const row = await purchaseItemDal.getById(id)
          if (!row) return null
          if (row.organization_id !== req.user.organization_id) return forbidden(res)
          return row
        },
        list: async (query) => {
          return await purchaseItemDal.list({
            ...query,
            organization_id: req.user.organization_id,
          })
        },
        updateById: async (id, data) => {
          const existing = await purchaseItemDal.getById(id)
          if (!existing) return null
          if (existing.organization_id !== req.user.organization_id) return forbidden(res)
          return await purchaseItemDal.updateById(id, data)
        },
        deleteById: async (id) => {
          const existing = await purchaseItemDal.getById(id)
          if (!existing) return false
          if (existing.organization_id !== req.user.organization_id) return forbidden(res)
          return await purchaseItemDal.deleteById(id)
        },
      },
      transfer: {
        create: async (data) => {
          if (data?.organization_id !== req.user.organization_id) return forbidden(res)
          return await transferDal.create(data)
        },
        getById: async (id) => {
          const row = await transferDal.getById(id)
          if (!row) return null
          if (row.organization_id !== req.user.organization_id) return forbidden(res)
          return row
        },
        list: async (query) => {
          return await transferDal.list({ ...query, organization_id: req.user.organization_id })
        },
        updateById: async (id, data) => {
          const existing = await transferDal.getById(id)
          if (!existing) return null
          if (existing.organization_id !== req.user.organization_id) return forbidden(res)
          if (data?.organization_id !== undefined && data.organization_id !== req.user.organization_id)
            return forbidden(res)
          return await transferDal.updateById(id, data)
        },
        deleteById: async (id) => {
          const existing = await transferDal.getById(id)
          if (!existing) return false
          if (existing.organization_id !== req.user.organization_id) return forbidden(res)
          return await transferDal.deleteById(id)
        },
      },
      transferItem: {
        create: async (data) => {
          if (data?.organization_id !== req.user.organization_id) return forbidden(res)
          return await transferItemDal.create(data)
        },
        getById: async (id) => {
          const row = await transferItemDal.getById(id)
          if (!row) return null
          if (row.organization_id !== req.user.organization_id) return forbidden(res)
          return row
        },
        list: async (query) => {
          return await transferItemDal.list({ ...query, organization_id: req.user.organization_id })
        },
        updateById: async (id, data) => {
          const existing = await transferItemDal.getById(id)
          if (!existing) return null
          if (existing.organization_id !== req.user.organization_id) return forbidden(res)
          return await transferItemDal.updateById(id, data)
        },
        deleteById: async (id) => {
          const existing = await transferItemDal.getById(id)
          if (!existing) return false
          if (existing.organization_id !== req.user.organization_id) return forbidden(res)
          return await transferItemDal.deleteById(id)
        },
      },
      runningStock: {
        getById: async (id) => {
          const row = await runningStockDal.getById(id)
          if (!row) return null
          if (row.organization_id !== req.user.organization_id) return forbidden(res)
          return row
        },
        list: async (query) => {
          return await runningStockDal.list({
            ...query,
            organization_id: req.user.organization_id,
          })
        },
      },
      stockTransitionState: {
        getById: async (id) => {
          const row = await stockTransitionStateDal.getById(id)
          if (!row) return null
          if (row.organization_id !== req.user.organization_id) return forbidden(res)
          return row
        },
        list: async (query) => {
          return await stockTransitionStateDal.list({
            ...query,
            organization_id: req.user.organization_id,
          })
        },
      },
    }
    return next()
  }

  req.models = {
    user: {
      create: async () => forbidden(res),
      getById: async (id) => {
        if (Number(id) !== req.user.id) return forbidden(res)
        return await userDal.getById(req.user.id)
      },
      getAll: async () => {
        const row = await userDal.getById(req.user.id)
        return row ? [row] : []
      },
      updateById: async (id, data) => {
        if (Number(id) !== req.user.id) return forbidden(res)
        if (data?.organization_id !== undefined && data.organization_id !== req.user.organization_id)
          return forbidden(res)
        return await userDal.updateById(req.user.id, data)
      },
      deleteById: async (id) => {
        if (Number(id) !== req.user.id) return forbidden(res)
        return await userDal.deleteById(req.user.id)
      },
    },
    category: {
      create: async () => forbidden(res),
      getById: async (id) => {
        const row = await categoryDal.getById(id)
        if (!row) return null
        if (row.organization_id !== req.user.organization_id) return forbidden(res)
        return row
      },
      list: async (query) => {
        return await categoryDal.list({ ...query, organization_id: req.user.organization_id })
      },
      updateById: async () => forbidden(res),
      deleteById: async () => forbidden(res),
    },
    ingredient: {
      create: async () => forbidden(res),
      listNamesByOrganization: async (organization_id) => {
        if (organization_id !== req.user.organization_id) return forbidden(res)
        return await ingredientDal.listNamesByOrganization(organization_id)
      },
      bulkCreate: async () => forbidden(res),
      bulkUpdate: async () => forbidden(res),
      getByItemCode: async ({ organization_id, item_code }) => {
        if (organization_id !== req.user.organization_id) return forbidden(res)
        return await ingredientDal.getByItemCode({ organization_id, item_code })
      },
      getById: async (id) => {
        const row = await ingredientDal.getById(id)
        if (!row) return null
        if (row.organization_id !== req.user.organization_id) return forbidden(res)
        return row
      },
      list: async (query) => {
        return await ingredientDal.list({ ...query, organization_id: req.user.organization_id })
      },
      updateById: async () => forbidden(res),
      deleteById: async () => forbidden(res),
    },
    origin: {
      create: async () => forbidden(res),
      getById: async (id) => {
        const row = await originDal.getById(id)
        if (!row) return null
        if (row.organization_id !== req.user.organization_id) return forbidden(res)
        return row
      },
      list: async (query) => {
        return await originDal.list({ ...query, organization_id: req.user.organization_id })
      },
      updateById: async () => forbidden(res),
      deleteById: async () => forbidden(res),
    },
    preparation: {
      create: async () => forbidden(res),
      getById: async (id) => {
        const row = await preparationDal.getById(id)
        if (!row) return null
        if (row.organization_id !== req.user.organization_id) return forbidden(res)
        return row
      },
      list: async (query) => {
        return await preparationDal.list({ ...query, organization_id: req.user.organization_id })
      },
      updateById: async () => forbidden(res),
      deleteById: async () => forbidden(res),
    },
    preparationItem: {
      create: async () => forbidden(res),
      getById: async (id) => {
        const row = await preparationItemDal.getById(id)
        if (!row) return null
        if (row.organization_id !== req.user.organization_id) return forbidden(res)
        return row
      },
      list: async (query) => {
        return await preparationItemDal.list({
          ...query,
          organization_id: req.user.organization_id,
        })
      },
      updateById: async () => forbidden(res),
      deleteById: async () => forbidden(res),
    },
    unitConversion: {
      create: async () => forbidden(res),
      bulkCreate: async () => forbidden(res),
      getById: async (id) => {
        const row = await unitConversionDal.getById(id)
        if (!row) return null
        if (row.organization_id !== req.user.organization_id) return forbidden(res)
        return row
      },
      list: async (query) => {
        return await unitConversionDal.list({
          ...query,
          organization_id: req.user.organization_id,
        })
      },
      updateById: async () => forbidden(res),
      bulkUpdate: async () => forbidden(res),
      deleteById: async () => forbidden(res),
    },
    purchase: {
      create: async () => forbidden(res),
      getById: async (id) => {
        const row = await purchaseDal.getById(id)
        if (!row) return null
        if (row.organization_id !== req.user.organization_id) return forbidden(res)
        return row
      },
      list: async (query) => {
        return await purchaseDal.list({ ...query, organization_id: req.user.organization_id })
      },
      updateById: async () => forbidden(res),
      deleteById: async () => forbidden(res),
    },
    purchaseItem: {
      create: async () => forbidden(res),
      getById: async (id) => {
        const row = await purchaseItemDal.getById(id)
        if (!row) return null
        if (row.organization_id !== req.user.organization_id) return forbidden(res)
        return row
      },
      list: async (query) => {
        return await purchaseItemDal.list({
          ...query,
          organization_id: req.user.organization_id,
        })
      },
      updateById: async () => forbidden(res),
      deleteById: async () => forbidden(res),
    },
    transfer: {
      create: async () => forbidden(res),
      getById: async (id) => {
        const row = await transferDal.getById(id)
        if (!row) return null
        if (row.organization_id !== req.user.organization_id) return forbidden(res)
        return row
      },
      list: async (query) => {
        return await transferDal.list({ ...query, organization_id: req.user.organization_id })
      },
      updateById: async () => forbidden(res),
      deleteById: async () => forbidden(res),
    },
    transferItem: {
      create: async () => forbidden(res),
      getById: async (id) => {
        const row = await transferItemDal.getById(id)
        if (!row) return null
        if (row.organization_id !== req.user.organization_id) return forbidden(res)
        return row
      },
      list: async (query) => {
        return await transferItemDal.list({ ...query, organization_id: req.user.organization_id })
      },
      updateById: async () => forbidden(res),
      deleteById: async () => forbidden(res),
    },
    runningStock: {
      getById: async (id) => {
        const row = await runningStockDal.getById(id)
        if (!row) return null
        if (row.organization_id !== req.user.organization_id) return forbidden(res)
        return row
      },
      list: async (query) => {
        return await runningStockDal.list({
          ...query,
          organization_id: req.user.organization_id,
        })
      },
    },
    stockTransitionState: {
      getById: async (id) => {
        const row = await stockTransitionStateDal.getById(id)
        if (!row) return null
        if (row.organization_id !== req.user.organization_id) return forbidden(res)
        return row
      },
      list: async (query) => {
        return await stockTransitionStateDal.list({
          ...query,
          organization_id: req.user.organization_id,
        })
      },
    },
  }
  return next()
}

module.exports = { withScopedModels }
