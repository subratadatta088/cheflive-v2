const bcrypt = require('bcryptjs')

const PASSWORD_SALT_ROUNDS = Number(process.env.PASSWORD_SALT_ROUNDS || 10)

async function hashPassword(plain) {
  return await bcrypt.hash(String(plain), PASSWORD_SALT_ROUNDS)
}

async function verifyPassword(plain, hash) {
  return await bcrypt.compare(String(plain), String(hash))
}

module.exports = { hashPassword, verifyPassword }
