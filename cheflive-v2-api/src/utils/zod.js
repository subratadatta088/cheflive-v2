const { z } = require('zod')

// Accepts true/false, 1/0, '1'/'0', 'true'/'false' (case-insensitive)
// and normalizes to a real boolean. Useful for query string flags.
const BooleanFlagSchema = z.preprocess((v) => {
  if (v === undefined || v === null || v === '') return undefined
  if (typeof v === 'boolean') return v
  if (typeof v === 'number') return v !== 0
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase()
    if (s === 'true' || s === '1') return true
    if (s === 'false' || s === '0') return false
  }
  return v
}, z.boolean())

module.exports = { BooleanFlagSchema }
