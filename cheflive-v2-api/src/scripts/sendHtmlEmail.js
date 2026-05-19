require('dotenv').config()
const fs = require('fs')
const path = require('path')
const { z } = require('zod')
const { EmailServiceFactory } = require('../services/email')

const ArgsSchema = z.object({
  to: z.string().email(),
  htmlPath: z.string().min(1),
  subject: z.string().min(1).optional(),
})

function subjectFromPath(filePath) {
  const base = path.basename(filePath, path.extname(filePath))
  const cleaned = base.replace(/[-_]+/g, ' ').trim()
  return cleaned ? cleaned : 'Email'
}

function readHtmlFile(htmlPath) {
  const resolved = path.resolve(htmlPath)
  if (!fs.existsSync(resolved)) {
    throw new Error(`HTML file not found: ${resolved}`)
  }
  const stat = fs.statSync(resolved)
  if (!stat.isFile()) {
    throw new Error(`Path is not a file: ${resolved}`)
  }
  return { resolved, html: fs.readFileSync(resolved, 'utf8') }
}

async function main() {
  const parsed = ArgsSchema.safeParse({
    to: process.argv[2],
    htmlPath: process.argv[3],
    subject: process.argv[4],
  })

  if (!parsed.success) {
    console.error('Usage: node src/scripts/sendHtmlEmail.js <to-email> <html-file-path> [subject]')
    console.error('')
    console.error('Example:')
    console.error('  node src/scripts/sendHtmlEmail.js you@example.com temp/template.html')
    console.error('  node src/scripts/sendHtmlEmail.js you@example.com temp/template.html "Purchase Report"')
    process.exit(1)
  }

  const { to, htmlPath, subject: subjectArg } = parsed.data
  const { resolved, html } = readHtmlFile(htmlPath)

  if (!html.trim()) {
    throw new Error(`HTML file is empty: ${resolved}`)
  }

  const subject = subjectArg ?? subjectFromPath(resolved)
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
        to,
        subject,
        htmlFile: resolved,
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
