const { EventEmitter } = require('node:events')
const { EventTypes } = require('./types')

/**
 * Shared process-local event bus.
 * Producers: events.emit(EventTypes.PurchaseEntryCreated, payload)
 * Consumers: events.on(EventTypes.PurchaseEntryCreated, handler)
 */
const events = new EventEmitter()

function emit(eventType, payload) {
  return events.emit(eventType, payload)
}

function on(eventType, handler) {
  events.on(eventType, handler)
  return () => events.off(eventType, handler)
}

function once(eventType, handler) {
  events.once(eventType, handler)
}

module.exports = {
  events,
  emit,
  on,
  once,
  EventTypes,
}

