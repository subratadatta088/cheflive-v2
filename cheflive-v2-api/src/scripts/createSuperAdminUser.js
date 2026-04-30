require('dotenv').config()
const { z } = require('zod')
const { db } = require('../db')
const { migrate } = require('../db/migrate')
const { getRoleModel, getUserModel } = require('../drivers/factory')

const ArgsSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
  name: z.string().min(1).optional(),
})

async function main() {
  const parsed = ArgsSchema.safeParse({
    username: process.argv[2],
    password: process.argv[3],
    name: process.argv[4],
  })
  if (!parsed.success) {
    console.error('Usage: node src/scripts/createSuperAdminUser.js <username> <password> [name]')
    process.exit(1)
  }

  await migrate(db())
  const userDal = getUserModel()
  const roleDal = getRoleModel()

  const user = await userDal.create({
    organization_id: null,
    username: parsed.data.username,
    password: parsed.data.password,
    name: parsed.data.name,
  })

  await roleDal.assignRoleToUser({
    user_id: user.id,
    organization_id: null,
    role_name: 'superadmin',
  })

  const { password: _password, ...safe } = user
  console.log(JSON.stringify({ user: safe, roles: ['superadmin'] }, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

