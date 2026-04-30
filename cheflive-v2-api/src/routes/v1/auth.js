const express = require('express')
const jwt = require('jsonwebtoken')
const { z } = require('zod')
const { getUserModel } = require('../../drivers/factory')
const { verifyPassword } = require('../../utils/password')
const { requireAuth } = require('../../middleware/auth')
const { withScopedModels } = require('../../middleware/rbacModels')

const router = express.Router()

const LoginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
})

router.post('/login', async (req, res) => {
  const secret = process.env.JWT_SECRET
  if (!secret) return res.status(500).json({ error: 'JWT_SECRET missing' })

  const parsed = LoginSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' })

  const userDal = getUserModel()
  if (typeof userDal.getLoginPayloadByUsername !== 'function') {
    return res.status(500).json({ error: 'Driver does not support login query' })
  }

  const payload = await userDal.getLoginPayloadByUsername(parsed.data.username)
  if (!payload?.user) return res.status(401).json({ error: 'Invalid credentials' })

  const ok = await verifyPassword(parsed.data.password, payload.user.password)
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' })

  const { password: _password, ...safeUser } = payload.user

  const claims = {
    id: payload.user.id,
    organization_id: payload.user.organization_id,
    roles: payload.roles,
  }

  const token = jwt.sign(claims, secret, { expiresIn: '7d' })
  return res.json({ token, user: safeUser, organization: payload.organization, roles: payload.roles })
})

router.get('/me', requireAuth, withScopedModels, async (req, res) => {
  const me = await req.models.user.getById(req.user.id)
  return res.json({ user: me })
})

module.exports = { authRouter: router }
