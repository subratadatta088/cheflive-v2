function readDbDriver() {
  return (process.env.DB_DRIVER || process.env.DATABASE_DRIVER || 'sqlite').toLowerCase()
}

function getUserModel() {
  const driver = readDbDriver()

  if (driver === 'sqlite') {
    const { UserSqliteDAL } = require('./sqlite/models/UserSqliteDAL')
    return new UserSqliteDAL()
  }

  throw new Error(`Unsupported DB_DRIVER: ${driver}`)
}

function getRoleModel() {
  const driver = readDbDriver()

  if (driver === 'sqlite') {
    const { RoleSqliteDAL } = require('./sqlite/models/RoleSqliteDAL')
    return new RoleSqliteDAL()
  }

  throw new Error(`Unsupported DB_DRIVER: ${driver}`)
}

function getOrganizationModel() {
  const driver = readDbDriver()

  if (driver === 'sqlite') {
    const { OrganizationSqliteDAL } = require('./sqlite/models/OrganizationSqliteDAL')
    return new OrganizationSqliteDAL()
  }

  throw new Error(`Unsupported DB_DRIVER: ${driver}`)
}

function getIngredientModel() {
  const driver = readDbDriver()

  if (driver === 'sqlite') {
    const { IngredientSqliteDAL } = require('./sqlite/models/IngredientSqliteDAL')
    return new IngredientSqliteDAL()
  }

  throw new Error(`Unsupported DB_DRIVER: ${driver}`)
}

function getOriginModel() {
  const driver = readDbDriver()

  if (driver === 'sqlite') {
    const { OriginSqliteDAL } = require('./sqlite/models/OriginSqliteDAL')
    return new OriginSqliteDAL()
  }

  throw new Error(`Unsupported DB_DRIVER: ${driver}`)
}

function getCategoryModel() {
  const driver = readDbDriver()

  if (driver === 'sqlite') {
    const { CategorySqliteDAL } = require('./sqlite/models/CategorySqliteDAL')
    return new CategorySqliteDAL()
  }

  throw new Error(`Unsupported DB_DRIVER: ${driver}`)
}

function getPreparationModel() {
  const driver = readDbDriver()

  if (driver === 'sqlite') {
    const { PreparationSqliteDAL } = require('./sqlite/models/PreparationSqliteDAL')
    return new PreparationSqliteDAL()
  }

  throw new Error(`Unsupported DB_DRIVER: ${driver}`)
}

function getPreparationItemModel() {
  const driver = readDbDriver()

  if (driver === 'sqlite') {
    const { PreparationItemSqliteDAL } = require('./sqlite/models/PreparationItemSqliteDAL')
    return new PreparationItemSqliteDAL()
  }

  throw new Error(`Unsupported DB_DRIVER: ${driver}`)
}

function getUnitConversionModel() {
  const driver = readDbDriver()

  if (driver === 'sqlite') {
    const { UnitConversionSqliteDAL } = require('./sqlite/models/UnitConversionSqliteDAL')
    return new UnitConversionSqliteDAL()
  }

  throw new Error(`Unsupported DB_DRIVER: ${driver}`)
}

function getPurchaseModel() {
  const driver = readDbDriver()

  if (driver === 'sqlite') {
    const { PurchaseSqliteDAL } = require('./sqlite/models/PurchaseSqliteDAL')
    return new PurchaseSqliteDAL()
  }

  throw new Error(`Unsupported DB_DRIVER: ${driver}`)
}

function getPurchaseItemModel() {
  const driver = readDbDriver()

  if (driver === 'sqlite') {
    const { PurchaseItemSqliteDAL } = require('./sqlite/models/PurchaseItemSqliteDAL')
    return new PurchaseItemSqliteDAL()
  }

  throw new Error(`Unsupported DB_DRIVER: ${driver}`)
}

function getTransferModel() {
  const driver = readDbDriver()

  if (driver === 'sqlite') {
    const { TransferSqliteDAL } = require('./sqlite/models/TransferSqliteDAL')
    return new TransferSqliteDAL()
  }

  throw new Error(`Unsupported DB_DRIVER: ${driver}`)
}

function getTransferItemModel() {
  const driver = readDbDriver()

  if (driver === 'sqlite') {
    const { TransferItemSqliteDAL } = require('./sqlite/models/TransferItemSqliteDAL')
    return new TransferItemSqliteDAL()
  }

  throw new Error(`Unsupported DB_DRIVER: ${driver}`)
}

function getUtilizationModel() {
  const driver = readDbDriver()

  if (driver === 'sqlite') {
    const { UtilizationSqliteDAL } = require('./sqlite/models/UtilizationSqliteDAL')
    return new UtilizationSqliteDAL()
  }

  throw new Error(`Unsupported DB_DRIVER: ${driver}`)
}

function getUtilizationItemModel() {
  const driver = readDbDriver()

  if (driver === 'sqlite') {
    const { UtilizationItemSqliteDAL } = require('./sqlite/models/UtilizationItemSqliteDAL')
    return new UtilizationItemSqliteDAL()
  }

  throw new Error(`Unsupported DB_DRIVER: ${driver}`)
}

function getRunningStockModel() {
  const driver = readDbDriver()

  if (driver === 'sqlite') {
    const { RunningStockSqliteDAL } = require('./sqlite/models/RunningStockSqliteDAL')
    return new RunningStockSqliteDAL()
  }

  throw new Error(`Unsupported DB_DRIVER: ${driver}`)
}

function getStockTransitionStateModel() {
  const driver = readDbDriver()

  if (driver === 'sqlite') {
    const {
      StockTransitionStateSqliteDAL,
    } = require('./sqlite/models/StockTransitionStateSqliteDAL')
    return new StockTransitionStateSqliteDAL()
  }

  throw new Error(`Unsupported DB_DRIVER: ${driver}`)
}

module.exports = {
  getUserModel,
  getRoleModel,
  getOrganizationModel,
  getIngredientModel,
  getOriginModel,
  getCategoryModel,
  getPreparationModel,
  getPreparationItemModel,
  getUnitConversionModel,
  getPurchaseModel,
  getPurchaseItemModel,
  getTransferModel,
  getTransferItemModel,
  getUtilizationModel,
  getUtilizationItemModel,
  getRunningStockModel,
  getStockTransitionStateModel,
}
