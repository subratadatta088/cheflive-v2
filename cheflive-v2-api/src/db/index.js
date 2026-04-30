const { openSqlite } = require('../drivers/sqlite/db')

function db() {
  const driver = (process.env.DB_DRIVER || process.env.DATABASE_DRIVER || 'sqlite').toLowerCase()
  if (driver === 'sqlite') return openSqlite()
  throw new Error(`Unsupported DB_DRIVER: ${driver}`)
}

module.exports = { db }

