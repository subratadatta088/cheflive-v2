require('dotenv').config()
const { z } = require('zod')
const { db } = require('../db')
const { migrate } = require('../db/migrate')
const { getOrganizationModel } = require('../drivers/factory')

const ArgsSchema = z.object({
  name: z.string().min(1),
})

async function main() {
  const parsed = ArgsSchema.safeParse({ name: process.argv[2] })
  if (!parsed.success) {
    console.error('Usage: node src/scripts/createOrganization.js <org_name>')
    process.exit(1)
  }

  await migrate(db())
  const orgDal = getOrganizationModel()
  const org = await orgDal.create({ name: parsed.data.name })
  console.log(JSON.stringify({ organization: org }, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

