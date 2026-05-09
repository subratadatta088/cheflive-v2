const fs = require('node:fs/promises')
const fsSync = require('node:fs')
const path = require('node:path')

/**
 * File-based job log store.
 *
 *   job-logs/<id>.json        ← in-flight only: queued / running / failed
 *                               (successful jobs DELETE their file — no pile-up)
 *   job-logs/completed/       ← legacy retention cleanup only (older builds);
 *                               new runs do not write here
 *   job-logs/dead-letter/     ← unknown types / quarantine (not auto-retried)
 *
 * Status updates are written in place while the job runs. On success the file
 * is removed. Retention pruner may still delete old files under `completed/`
 * from previous deployments (EVENT_JOBS_RETENTION_DAYS).
 */

const JOBS_DIRNAME = 'job-logs'
const COMPLETED_SUBDIR = 'completed'
const DEAD_LETTER_SUBDIR = 'dead-letter'

function jobsDir() {
  return path.join(process.cwd(), JOBS_DIRNAME)
}

function subDir(name) {
  return path.join(jobsDir(), name)
}

function jobFilePath(jobId) {
  return path.join(jobsDir(), `${jobId}.json`)
}

function fileInSubdir(subdir, jobId) {
  return path.join(subDir(subdir), `${jobId}.json`)
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true })
}

class JobStore {
  async init() {
    await ensureDir(jobsDir())
    await ensureDir(subDir(COMPLETED_SUBDIR))
    await ensureDir(subDir(DEAD_LETTER_SUBDIR))
  }

  /**
   * Create the canonical log file for a freshly-enqueued job.
   * Uses sync I/O so the file exists before the async listener's first await,
   * allowing startup recovery to emit-then-remove without losing the payload.
   * @param {{ id: string, type: string, key: string, payload: any, status: string, created_at: string }} job
   */
  async create(job) {
    fsSync.mkdirSync(jobsDir(), { recursive: true })
    fsSync.writeFileSync(jobFilePath(job.id), JSON.stringify(job, null, 2), 'utf8')
  }

  /**
   * Patch the in-flight log file (status / timestamps / error / attempt).
   * @param {string} id
   * @param {Partial<{ status: string, started_at: string, completed_at: string, attempt: number, error: string }>} patch
   */
  async update(id, patch) {
    await ensureDir(jobsDir())
    const fp = jobFilePath(id)
    const raw = await fs.readFile(fp, 'utf8')
    const cur = JSON.parse(raw)
    const next = { ...cur, ...patch, updated_at: new Date().toISOString() }
    await fs.writeFile(fp, JSON.stringify(next, null, 2), 'utf8')
  }

  /**
   * Remove the in-flight log file for a finished-success job (or recovery
   * superseded duplicate). Safe if the file is already absent.
   * @param {string} id
   */
  async remove(id) {
    try {
      await fs.unlink(jobFilePath(id))
    } catch (e) {
      if (e?.code !== 'ENOENT') throw e
    }
  }

  /**
   * Move a job log file from `job-logs/<id>.json` into `job-logs/<subdir>/<id>.json`,
   * optionally applying a final patch BEFORE the move so the archived copy
   * captures the terminal state.
   *
   * @param {string} id
   * @param {'completed' | 'dead-letter'} subdir
   * @param {Partial<Record<string, unknown>> | null} [finalPatch]
   */
  async archiveTo(id, subdir, finalPatch) {
    const targetDir = subDir(subdir)
    await ensureDir(targetDir)
    const src = jobFilePath(id)
    const dst = path.join(targetDir, `${id}.json`)

    if (finalPatch && typeof finalPatch === 'object') {
      try {
        const raw = await fs.readFile(src, 'utf8')
        const cur = JSON.parse(raw)
        const next = { ...cur, ...finalPatch, updated_at: new Date().toISOString() }
        await fs.writeFile(src, JSON.stringify(next, null, 2), 'utf8')
      } catch {
        // ignore — file may be corrupt; the rename below will still try.
      }
    }

    try {
      await fs.rename(src, dst)
      return
    } catch {
      // EXDEV (cross-device) or similar: fall back to copy + unlink.
      try {
        const raw = await fs.readFile(src, 'utf8')
        await fs.writeFile(dst, raw, 'utf8')
        await fs.unlink(src)
      } catch {
        // If even the fallback fails, leave the source in place; the next
        // recovery pass will pick it up again. Never silent-delete.
      }
    }
  }

  /**
   * Read in-flight/failed job logs (top level only — not completed/dead-letter).
   * Returns:
   *   - parsed: well-formed job objects
   *   - corrupt: array of { filename, fullPath } for files that failed to parse
   *              (used by recovery to quarantine them, NOT to delete them).
   */
  async list() {
    await ensureDir(jobsDir())
    const entries = await fs.readdir(jobsDir())
    const parsed = []
    const corrupt = []
    for (const f of entries) {
      if (!f.endsWith('.json')) continue // skip subdirectories like completed/, dead-letter/
      const fullPath = path.join(jobsDir(), f)
      try {
        const raw = await fs.readFile(fullPath, 'utf8')
        if (!raw || !raw.trim()) {
          corrupt.push({ filename: f, fullPath })
          continue
        }
        parsed.push(JSON.parse(raw))
      } catch {
        corrupt.push({ filename: f, fullPath })
      }
    }
    return { parsed, corrupt }
  }

  /** List `completed/` files with their mtime (used by the retention pruner). */
  async listCompletedMeta() {
    const dir = subDir(COMPLETED_SUBDIR)
    await ensureDir(dir)
    const entries = await fs.readdir(dir)
    const out = []
    for (const f of entries) {
      if (!f.endsWith('.json')) continue
      const fp = path.join(dir, f)
      try {
        const stat = await fs.stat(fp)
        out.push({ filename: f, fullPath: fp, mtimeMs: stat.mtimeMs })
      } catch {
        // ignore
      }
    }
    return out
  }

  /**
   * Move an arbitrary top-level file to `dead-letter/` by filename, used for
   * corrupt/unparseable files we can't update via `archiveTo` (which needs
   * a job id).
   * @param {string} filename
   * @param {string} fullPath
   */
  async deadLetterRawFile(filename, fullPath) {
    const targetDir = subDir(DEAD_LETTER_SUBDIR)
    await ensureDir(targetDir)
    const dst = path.join(targetDir, filename)
    try {
      await fs.rename(fullPath, dst)
    } catch {
      try {
        const raw = await fs.readFile(fullPath, 'utf8').catch(() => '')
        await fs.writeFile(dst, raw, 'utf8')
        await fs.unlink(fullPath)
      } catch {
        // ignore — leave it in place
      }
    }
  }

  /** Used only by the retention pruner. Never call from request paths. */
  async removeCompletedFile(fullPath) {
    try {
      await fs.unlink(fullPath)
    } catch {
      // ignore
    }
  }
}

module.exports = { JobStore }
