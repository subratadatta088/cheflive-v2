const jwt = require('jsonwebtoken')
const { z } = require('zod')

const JwtUserSchema = z.object({
  id: z.number().int().positive(),
  organization_id: z.number().int().positive().nullable().optional(),
  roles: z.array(z.enum(['superadmin', 'admin', 'member'])).default([]),
})

function requireAuth(req, res, next) {
  try {
    const auth = req.headers.authorization || ''
    const token = auth.startsWith('Bearer ') ? auth.slice('Bearer '.length) : null
    if (!token) return res.status(401).json({ error: 'Unauthorized' })

    const secret = process.env.JWT_SECRET
    if (!secret) return res.status(500).json({ error: 'JWT_SECRET missing' })

    const decoded = jwt.verify(token, secret)
    req.user = JwtUserSchema.parse(decoded)
    return next()
  } catch {
    return res.status(401).json({ error: 'Unauthorized' })
  }
}

module.exports = { requireAuth }
