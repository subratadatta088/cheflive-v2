/**
 * Event type constants (domain events).
 *
 * Intentionally small + dependency-free:
 * - producers will emit these types
 * - handlers will map by these types
 */

const EventTypes = Object.freeze({
  PurchaseEntryCreated: 'PurchaseEntryCreated',
  PurchaseEntryUpdated: 'PurchaseEntryUpdated',
  PurchaseEntryDeleted: 'PurchaseEntryDeleted',
  TransferEntryCreated: 'TransferEntryCreated',
  TransferEntryUpdated: 'TransferEntryUpdated',
  TransferEntryDeleted: 'TransferEntryDeleted',

  StockUpdated: 'StockUpdated',
})

module.exports = { EventTypes }

