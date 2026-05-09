const fs = require('fs')
const path = require('path')

function exec(db, sql) {
  return new Promise((resolve, reject) => {
    db.exec(sql, (err) => {
      if (err) return reject(err)
      resolve()
    })
  })
}

function run(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, (err) => {
      if (err) return reject(err)
      resolve()
    })
  })
}

function get(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err)
      resolve(row)
    })
  })
}

function all(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err)
      resolve(rows)
    })
  })
}

/**
 * Tables expected to carry the full standard audit-column set.
 * Ordering doesn't matter; every entry is processed independently.
 */
const FULL_AUDIT_TABLES = [
  'organizations',
  'users',
  'roles',
  'ingredients',
  'categories',
  'ingredient_tags',
  'preparations',
  'preparation_items',
  'origins',
  'transfers',
  'transfer_items',
  'menus',
  'menu_items',
  'menu_tags',
  'utilizations',
  'utilization_items',
  'ingredient_unit_conversions',
  'purchases',
  'purchase_items',
  'running_stock',
  'stock_transition_states',
]

const FULL_AUDIT_COLUMNS = [
  'created_by',
  'updated_by',
  'created_at',
  'updated_at',
  'deleted_at',
  'deleted_by',
]

/**
 * Tables that carry a non-standard subset of audit columns (e.g. user_roles
 * historically has no `updated_at` / `updated_by`).
 */
const PARTIAL_AUDIT_TABLES = {
  user_roles: ['created_by', 'created_at', 'deleted_at', 'deleted_by'],
}

function columnTypeFor(name) {
  // *_at columns hold ISO timestamps; *_by columns hold user ids.
  return name.endsWith('_at') ? 'TEXT' : 'INTEGER'
}

async function tableExists(db, table) {
  const row = await get(
    db,
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`,
    [table],
  )
  return Boolean(row)
}

/**
 * Idempotent: reads the live table schema via PRAGMA table_info and adds any
 * missing columns from `wantedCols` one at a time. Each ALTER is executed on
 * its own (NOT inside a single migration transaction), so a duplicate-column
 * error on one column never rolls back the others.
 *
 * Returns the names of columns it actually added (for logging).
 */
async function ensureColumns(db, table, wantedCols) {
  if (!(await tableExists(db, table))) return []
  const info = await all(db, `PRAGMA table_info(${table})`)
  const existing = new Set(info.map((r) => String(r.name)))

  const added = []
  for (const col of wantedCols) {
    if (existing.has(col)) continue
    const type = columnTypeFor(col)
    try {
      await run(db, `ALTER TABLE ${table} ADD COLUMN ${col} ${type}`)
      added.push(col)
    } catch (err) {
      const msg = String(err?.message || '')
      // Race or pre-existing: ignore these specifically; surface anything else.
      if (
        !msg.includes('duplicate column name') &&
        !msg.includes('duplicate column')
      ) {
        throw err
      }
    }
  }
  return added
}

/**
 * Top-up missing audit columns across the schema. This runs every startup and
 * is a no-op once everything is present. It exists because some early dev
 * databases were created from an older schema snapshot that omitted columns
 * like `updated_at` / `deleted_at` on tables like `transfer_items` and
 * `purchase_items`. Doing this here is safer and faster than authoring one
 * surgical SQL migration per missing column on every developer's machine.
 */
async function ensureAuditColumns(db) {
  const summary = {}

  for (const table of FULL_AUDIT_TABLES) {
    const added = await ensureColumns(db, table, FULL_AUDIT_COLUMNS)
    if (added.length) summary[table] = added
  }

  for (const [table, cols] of Object.entries(PARTIAL_AUDIT_TABLES)) {
    const added = await ensureColumns(db, table, cols)
    if (added.length) summary[table] = (summary[table] || []).concat(added)
  }

  if (Object.keys(summary).length) {
    console.log(
      JSON.stringify({
        ts: new Date().toISOString(),
        level: 'warn',
        msg: 'audit_columns_added',
        added: summary,
      }),
    )
  }
}

async function migrate(db) {
  const migrationsDir = path.join(__dirname, 'migrations')

  await exec(
    db,
    `
CREATE TABLE IF NOT EXISTS _migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  filename TEXT NOT NULL UNIQUE,
  applied_at TEXT NOT NULL
);
`
  )

  // Top-up missing audit columns (created_at / updated_at / deleted_at /
  // created_by / updated_by / deleted_by) across known tables before the
  // SQL migration loop runs. Idempotent: a no-op when everything is present.
  // Fixes legacy dev databases whose tables were created from older schema
  // snapshots without the full audit-column set.
  try {
    await ensureAuditColumns(db)
  } catch (e) {
    console.error(
      JSON.stringify({
        ts: new Date().toISOString(),
        level: 'error',
        msg: 'audit_columns_topup_failed',
        error: String(e?.message || e),
      }),
    )
    // Don't throw — let the SQL migration loop run anyway; specific issues
    // will surface as their own errors.
  }

  const applied = await all(db, 'SELECT filename FROM _migrations')
  const appliedSet = new Set(applied.map((r) => r.filename))

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort()

  for (const file of files) {
    if (appliedSet.has(file)) continue
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8')
    const appliedAt = new Date().toISOString()
    try {
      await exec(db, `BEGIN; ${sql}`)
      await run(db, 'INSERT INTO _migrations (filename, applied_at) VALUES (?, ?)', [
        file,
        appliedAt,
      ])
      await exec(db, 'COMMIT')
    } catch (err) {
      try {
        await exec(db, 'ROLLBACK')
      } catch {
        // ignore
      }
      const msg = String(err?.message || '')
      const duplicateColumn =
        msg.includes('duplicate column name') || msg.includes('duplicate column')
      if (duplicateColumn) {
        await run(db, 'INSERT OR IGNORE INTO _migrations (filename, applied_at) VALUES (?, ?)', [
          file,
          appliedAt,
        ])
        continue
      }
      err.message = `Migration failed: ${file}\n${msg}`
      throw err
    }
  }
}

module.exports = { migrate }

