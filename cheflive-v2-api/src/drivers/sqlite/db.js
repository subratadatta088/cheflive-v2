const path = require('path')
const sqlite3 = require('sqlite3')

function sqliteDbPath() {
  return (
    process.env.SQLITE_DB_PATH ||
    process.env.DB_PATH ||
    path.join(process.cwd(), 'cheflive.db')
  )
}

function openSqlite() {
  return new sqlite3.Database(sqliteDbPath())
}

module.exports = { openSqlite }
