function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * In-process keyed async queue.
 * - Serializes tasks per key (org id)
 * - Allows concurrency across different keys (bounded)
 */
class KeyedAsyncQueue {
  /**
   * @param {{ maxConcurrency?: number, maxAttempts?: number, baseRetryDelayMs?: number }} [opts]
   */
  constructor(opts = {}) {
    this.maxConcurrency = Number(opts.maxConcurrency || 4)
    this.maxAttempts = Number(opts.maxAttempts || 3)
    this.baseRetryDelayMs = Number(opts.baseRetryDelayMs || 250)

    /** @type {Map<string, Promise<void>>} */
    this._tails = new Map()
    /** @type {number} */
    this._active = 0
    /** @type {Array<() => void>} */
    this._waiters = []
  }

  async _acquireSlot() {
    if (this._active < this.maxConcurrency) {
      this._active++
      return
    }
    await new Promise((resolve) => this._waiters.push(resolve))
    this._active++
  }

  _releaseSlot() {
    this._active = Math.max(0, this._active - 1)
    const next = this._waiters.shift()
    if (next) next()
  }

  /**
   * Enqueue a task for a key.
   * @param {string|number} key
   * @param {(ctx: { attempt: number }) => Promise<void>} task
   */
  enqueue(key, task) {
    const k = String(key)
    const prev = this._tails.get(k) || Promise.resolve()

    const run = async () => {
      await this._acquireSlot()
      try {
        for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
          try {
            await task({ attempt })
            return
          } catch (e) {
            if (attempt >= this.maxAttempts) throw e
            const delay = this.baseRetryDelayMs * Math.pow(2, attempt - 1)
            await sleep(delay)
          }
        }
      } finally {
        this._releaseSlot()
      }
    }

    // Chain per key; swallow previous errors so the chain doesn't break.
    const nextTail = prev.catch(() => undefined).then(run)
    this._tails.set(k, nextTail.then(() => undefined, () => undefined))
    return nextTail
  }

  /** @param {string|number} key */
  pendingForKey(key) {
    return this._tails.has(String(key))
  }
}

module.exports = { KeyedAsyncQueue }

