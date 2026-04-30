require('dotenv').config()
const { z } = require('zod')
const { db } = require('../db')
const { migrate } = require('../db/migrate')
const { getRoleModel, getUserModel } = require('../drivers/factory')

const ArgsSchema = z.object({
  organization_id: z.coerce.number().int().positive(),
  username: z.string().min(1),
  password: z.string().min(1),
  name: z.string().min(1).optional(),
})

async function main() {
  const parsed = ArgsSchema.safeParse({
    organization_id: process.argv[2],
    username: process.argv[3],
    password: process.argv[4],
    name: process.argv[5],
  })
  if (!parsed.success) {
    console.error(
      'Usage: node src/scripts/createAdminUser.js <organization_id> <username> <password> [name]'
    )
    process.exit(1)
  }

  await migrate(db())
  const userDal = getUserModel()
  const roleDal = getRoleModel()

  const user = await userDal.create({
    organization_id: parsed.data.organization_id,
    username: parsed.data.username,
    password: parsed.data.password,
    name: parsed.data.name,
  })

  await roleDal.assignRoleToUser({
    user_id: user.id,
    organization_id: user.organization_id,
    role_name: 'admin',
  })

  const { password: _password, ...safe } = user
  console.log(JSON.stringify({ user: safe, roles: ['admin'] }, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

