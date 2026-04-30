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

function all(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err)
      resolve(rows)
    })
  })
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

