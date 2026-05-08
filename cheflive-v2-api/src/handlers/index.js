const crypto = require('node:crypto')
const { events, EventTypes } = require('../events')
const { KeyedAsyncQueue } = require('./queue')
const { JobStore } = require('./jobStore')
const log = require('./logger')

const purchaseHandlers = require('./purchaseHandlers')
const transferHandlers = require('./transferHandlers')
const stockHandlers = require('./stockHandlers')

let _registered = false

function newJobId() {
  return crypto.randomBytes(16).toString('hex')
}

function extractKey(payload) {
  const orgId = payload?.organization_id
  return orgId ? String(orgId) : 'unknown'
}

function buildModels() {
  // Keep handler layer independent of Express req.models.
  // These DALs talk directly to sqlite and already enforce org checks where needed.
  const {
    getIngredientModel,
    getPurchaseModel,
    getRunningStockModel,
    getStockTransitionStateModel,
    getTransferModel,
  } = require('../drivers/factory')
  return {
    ingredient: getIngredientModel(),
    purchase: getPurchaseModel(),
    runningStock: getRunningStockModel(),
    stockTransitionState: getStockTransitionStateModel(),
    transfer: getTransferModel(),
  }
}

/**
 * Register all domain event handlers exactly once.
 * Called from app startup.
 */
async function registerHandlers() {
  if (_registered) return
  _registered = true

  const queue = new KeyedAsyncQueue({
    maxConcurrency: Number(process.env.EVENT_MAX_CONCURRENCY || 4),
    maxAttempts: Number(process.env.EVENT_MAX_ATTEMPTS || 3),
    baseRetryDelayMs: Number(process.env.EVENT_RETRY_DELAY_MS || 250),
  })

  const store = new JobStore()
  await store.init()

  // On startup: log any leftover jobs (previous crash, etc.)
  try {
    const leftovers = await store.list()
    if (leftovers.length) {
      log.warn('event_jobs_leftover', { count: leftovers.length })
    }
  } catch (e) {
    log.error('event_jobs_leftover_failed', { error: String(e?.message || e) })
  }

  const bind = (eventType, handler) => {
    events.on(eventType, async (payload) => {
      const key = extractKey(payload)
      const jobId = newJobId()
      const createdAt = new Date().toISOString()

      const job = {
        id: jobId,
        type: eventType,
        key,
        payload,
        status: 'queued',
        created_at: createdAt,
      }

      try {
        await store.create(job)
      } catch (e) {
        log.error('event_job_store_create_failed', { jobId, type: eventType, error: String(e?.message || e) })
      }

      queue.enqueue(key, async ({ attempt }) => {
        const startedAt = Date.now()
        const startedIso = new Date().toISOString()
        try {
          await store.update(jobId, { status: 'running', started_at: startedIso, attempt })
        } catch {
          // ignore
        }

        try {
          const models = buildModels()
          await handler({ models, payload })

          const completedIso = new Date().toISOString()
          try {
            await store.update(jobId, { status: 'completed', completed_at: completedIso })
            await store.remove(jobId)
          } catch {
            // ignore
          }

          log.info('event_job_completed', {
            jobId,
            type: eventType,
            key,
            attempt,
            elapsedMs: Date.now() - startedAt,
          })
        } catch (e) {
          const msg = String(e?.message || e)
          try {
            await store.update(jobId, { status: 'failed', error: msg, attempt })
          } catch {
            // ignore
          }
          log.error('event_job_failed', { jobId, type: eventType, key, attempt, error: msg })
          throw e
        }
      })
    })
  }

  bind(EventTypes.PurchaseEntryCreated, purchaseHandlers.onPurchaseCreated)
  bind(EventTypes.PurchaseEntryUpdated, purchaseHandlers.onPurchaseUpdated)
  bind(EventTypes.PurchaseEntryDeleted, purchaseHandlers.onPurchaseDeleted)

  bind(EventTypes.TransferEntryCreated, transferHandlers.onTransferCreated)
  bind(EventTypes.TransferEntryUpdated, transferHandlers.onTransferUpdated)
  bind(EventTypes.TransferEntryDeleted, transferHandlers.onTransferDeleted)

  bind(EventTypes.StockUpdated, stockHandlers.onStockUpdated)

  log.info('event_handlers_registered', {})
}

module.exports = { registerHandlers }

