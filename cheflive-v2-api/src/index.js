require('dotenv').config()
const express = require('express')
const cors = require('cors')
const fileUpload = require('express-fileupload')
const { db } = require('./db')
const { migrate } = require('./db/migrate')
const { v1Router } = require('./routes/v1')


const app = express()

function redact(value) {
  if (!value || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map(redact)

  const out = {}
  for (const [k, v] of Object.entries(value)) {
    const key = String(k).toLowerCase()
    if (key.includes('password') || key.includes('token') || key.includes('authorization')) {
      out[k] = '[REDACTED]'
    } else {
      out[k] = redact(v)
    }
  }
  return out
}

app.use(cors())
app.use(express.json())
app.use(
  fileUpload({
    useTempFiles: false,
    limits: { fileSize: 10 * 1024 * 1024 },
  })
)

// Log API request/response metadata only (no payloads).
app.use((req, res, next) => {
  const startedAt = Date.now()

  // Capture error info if an error handler runs.
  res.locals.__error = null

  console.log(
    '[API request]',
    JSON.stringify({
      ts: new Date().toISOString(),
      method: req.method,
      path: req.originalUrl,
      params: redact(req.params),
      query: redact(req.query),
      // Don't log request bodies; at most log top-level keys for debugging.
      bodyKeys: req.body && typeof req.body === 'object' ? Object.keys(req.body).slice(0, 50) : undefined,
    }),
  )

  res.on('finish', () => {
    const elapsedMs = Date.now() - startedAt
    const status = res.statusCode
    const success = status < 400
    const err = res.locals.__error

    console.log(
      '[API response]',
      JSON.stringify({
        ts: new Date().toISOString(),
        method: req.method,
        path: req.originalUrl,
        status,
        success,
        elapsedMs,
        error: err
          ? {
              name: err.name,
              message: err.message,
              // Keep stacks short to avoid noisy logs
              stack: typeof err.stack === 'string' ? err.stack.split('\n').slice(0, 6).join('\n') : undefined,
            }
          : undefined,
      }),
    )
  })

  next()
})

app.get('/', (req, res) => {
  res.send('API Running')
})

app.use('/api/v1', v1Router)

// Error handler: attach error metadata for logger, then respond.
app.use((err, req, res, next) => {
  res.locals.__error = err

  // If a response already started, delegate to Express' default handler.
  if (res.headersSent) return next(err)

  const status = err.statusCode || err.status || 500
  res.status(status).json({
    success: false,
    error: {
      message: err.message || 'Internal Server Error',
    },
  })
})




const PORT = process.env.PORT || 5000

async function start() {
  await migrate(db())
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
  })
}

start().catch((err) => {
  console.error('Failed to start server:', err)
  process.exit(1)
})