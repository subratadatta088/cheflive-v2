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

          try {
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

  // Startup recovery + retention run AFTER handlers are bound, so any
  // re-emitted events have listeners.
  await recoverLeftoverJobs(store)
  await pruneCompleted(store)
}

/**
 * Recover leftover top-level job files (queued / running / failed from a
 * previous process). The contract:
 *
 *  - Before re-emitting, the original file is removed so only one in-flight
 *    copy exists; the new run creates a fresh log via the listener.
 *  - Duplicate payloads (same type + same JSON-serialised payload): only the
 *    oldest is replayed; extras are deleted so they are not replayed twice.
 *  - Unknown event types and corrupt files are moved to `dead-letter/` for
 *    inspection.
 *  - Disabled with EVENT_JOBS_RECOVER_ON_START=false.
 */
async function recoverLeftoverJobs(store) {
  if (String(process.env.EVENT_JOBS_RECOVER_ON_START ?? 'true').toLowerCase() === 'false') {
    return
  }

  let listing
  try {
    listing = await store.list()
  } catch (e) {
    log.error('event_jobs_leftover_failed', { error: String(e?.message || e) })
    return
  }

  const { parsed = [], corrupt = [] } = listing || {}
  if (!parsed.length && !corrupt.length) return

  const now = new Date().toISOString()

  // 1) Quarantine corrupt/empty files into dead-letter/ — never delete them.
  let quarantinedCorrupt = 0
  for (const c of corrupt) {
    try {
      await store.deadLetterRawFile(c.filename, c.fullPath)
      quarantinedCorrupt++
    } catch (e) {
      log.error('event_jobs_quarantine_failed', {
        filename: c.filename,
        error: String(e?.message || e),
      })
    }
  }

  // 2) Sort by created_at so we keep the OLDEST of each duplicate group.
  const sorted = parsed.slice().sort((a, b) =>
    String(a?.created_at || '').localeCompare(String(b?.created_at || '')),
  )

  const knownTypes = new Set(Object.values(EventTypes))
  const seenPayloadKey = new Set()
  const dedupeKey = (j) => `${j.type}::${j.key ?? ''}::${stableStringify(j.payload)}`

  let unknownType = 0
  let dedupedSkipped = 0
  let recovered = 0

  log.warn('event_jobs_recovery_start', {
    foundParsed: parsed.length,
    foundCorrupt: corrupt.length,
    quarantinedCorrupt,
  })

  for (const job of sorted) {
    if (!job || !job.id) continue

    // Unknown event type → dead-letter (no listener to consume it anyway).
    if (!knownTypes.has(job.type)) {
      try {
        await store.archiveTo(job.id, 'dead-letter', {
          status: 'dead-unknown-type',
          dead_lettered_at: now,
          reason: 'unknown event type',
        })
        unknownType++
      } catch (e) {
        log.error('event_job_recovery_dead_letter_failed', {
          jobId: job.id,
          error: String(e?.message || e),
        })
      }
      continue
    }

    // Dedupe: same payload as a job already scheduled for replay.
    const k = dedupeKey(job)
    if (seenPayloadKey.has(k)) {
      try {
        await store.remove(job.id)
        dedupedSkipped++
      } catch (e) {
        log.error('event_job_recovery_dedupe_failed', {
          jobId: job.id,
          error: String(e?.message || e),
        })
      }
      continue
    }
    seenPayloadKey.add(k)

    // Emit first: listener persists the new job synchronously (see JobStore.create),
    // then we drop the stale file so restarts only retry real leftovers.
    try {
      events.emit(job.type, job.payload)
      recovered++
    } catch (e) {
      log.error('event_job_recovery_emit_failed', {
        jobId: job.id,
        type: job.type,
        error: String(e?.message || e),
      })
      continue
    }

    try {
      await store.remove(job.id)
    } catch (e) {
      log.error('event_job_recovery_remove_failed', {
        jobId: job.id,
        error: String(e?.message || e),
      })
    }
  }

  log.info('event_jobs_recovery_done', {
    recovered,
    dedupedSkipped,
    unknownType,
    quarantinedCorrupt,
  })
}

/** Deterministic JSON stringify used for payload dedupe keys. */
function stableStringify(value) {
  if (value === undefined || value === null) return 'null'
  if (typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) {
    return '[' + value.map(stableStringify).join(',') + ']'
  }
  const keys = Object.keys(value).sort()
  return (
    '{' +
    keys.map((k) => JSON.stringify(k) + ':' + stableStringify(value[k])).join(',') +
    '}'
  )
}

/**
 * Delete completed/ files older than EVENT_JOBS_RETENTION_DAYS (default 30).
 * Set EVENT_JOBS_RETENTION_DAYS=0 (or negative) to keep them forever.
 */
async function pruneCompleted(store) {
  const days = Number(process.env.EVENT_JOBS_RETENTION_DAYS ?? 30)
  if (!Number.isFinite(days) || days <= 0) return

  let entries
  try {
    entries = await store.listCompletedMeta()
  } catch (e) {
    log.error('event_jobs_retention_list_failed', { error: String(e?.message || e) })
    return
  }
  if (!entries.length) return

  const cutoffMs = Date.now() - days * 24 * 60 * 60 * 1000
  let removed = 0
  for (const e of entries) {
    if (e.mtimeMs < cutoffMs) {
      await store.removeCompletedFile(e.fullPath)
      removed++
    }
  }
  if (removed) {
    log.info('event_jobs_retention_pruned', { removed, retentionDays: days })
  }
}

module.exports = { registerHandlers }

