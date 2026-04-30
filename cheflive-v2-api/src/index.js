require('dotenv').config()
const express = require('express')
const cors = require('cors')
const fileUpload = require('express-fileupload')
const { db } = require('./db')
const { migrate } = require('./db/migrate')
const { v1Router } = require('./routes/v1')


const app = express()

app.use(cors())
app.use(express.json())
app.use(
  fileUpload({
    useTempFiles: false,
    limits: { fileSize: 10 * 1024 * 1024 },
  })
)

app.get('/', (req, res) => {
  res.send('API Running')
})

app.use('/api/v1', v1Router)




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