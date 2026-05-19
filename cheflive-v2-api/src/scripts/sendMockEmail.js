require('dotenv').config()
const { z } = require('zod')
const { EmailServiceFactory } = require('../services/email')
const { buildMockEmail, listTemplateNames } = require('../services/email/mockTemplateData')

const ArgsSchema = z.object({
  template: z.string().min(1),
  to: z.string().email(),
})

async function main() {
  const parsed = ArgsSchema.safeParse({
    template: process.argv[2],
    to: process.argv[3],
  })

  if (!parsed.success) {
    const available = listTemplateNames()
    console.error('Usage: node src/scripts/sendMockEmail.js <template-name> <to-email>')
    console.error('')
    console.error('Example:')
    console.error('  node src/scripts/sendMockEmail.js purchase-report you@example.com')
    if (available.length) {
      console.error('')
      console.error(`Available templates: ${available.join(', ')}`)
    }
    process.exit(1)
  }

  const { template, to } = parsed.data
  const { subject, html } = buildMockEmail(template)
  const emailService = EmailServiceFactory.getInstance()

  const result = await emailService.send({
    to,
    subject,
    html,
  })

  console.log(
    JSON.stringify(
      {
        ok: true,
        template: template.replace(/\.hbs$/i, ''),
        to,
        subject,
        provider: result.provider,
        messageId: result.messageId ?? null,
      },
      null,
      2,
    ),
  )
}

main().catch((err) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        error: err?.message ?? String(err),
        provider: err?.provider ?? null,
        code: err?.code ?? null,
      },
      null,
      2,
    ),
  )
  process.exit(1)
})
