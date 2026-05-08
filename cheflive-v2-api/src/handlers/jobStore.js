const fs = require('node:fs/promises')
const path = require('node:path')

function jobsDir() {
  return path.join(process.cwd(), 'job-logs')
}

async function ensureDir() {
  await fs.mkdir(jobsDir(), { recursive: true })
}

function jobFilePath(jobId) {
  return path.join(jobsDir(), `${jobId}.json`)
}

/**
 * File-based job log store.
 * - One JSON file per job.
 * - Updated as status changes.
 * - Deleted on completion.
 */
class JobStore {
  async init() {
    await ensureDir()
  }

  /**
   * @param {{ id: string, type: string, key: string, payload: any, status: string, created_at: string }} job
   */
  async create(job) {
    await ensureDir()
    await fs.writeFile(jobFilePath(job.id), JSON.stringify(job, null, 2), 'utf8')
  }

  /**
   * @param {string} id
   * @param {Partial<{ status: string, started_at: string, completed_at: string, attempt: number, error: string }>} patch
   */
  async update(id, patch) {
    await ensureDir()
    const fp = jobFilePath(id)
    const raw = await fs.readFile(fp, 'utf8')
    const cur = JSON.parse(raw)
    const next = { ...cur, ...patch, updated_at: new Date().toISOString() }
    await fs.writeFile(fp, JSON.stringify(next, null, 2), 'utf8')
  }

  /** @param {string} id */
  async remove(id) {
    try {
      await fs.unlink(jobFilePath(id))
    } catch {
      // ignore
    }
  }

  /** Read all job files present on disk (e.g. at startup). */
  async list() {
    await ensureDir()
    const files = await fs.readdir(jobsDir())
    const out = []
    for (const f of files) {
      if (!f.endsWith('.json')) continue
      try {
        const raw = await fs.readFile(path.join(jobsDir(), f), 'utf8')
        out.push(JSON.parse(raw))
      } catch {
        // ignore bad files
      }
    }
    return out
  }
}

module.exports = { JobStore }

