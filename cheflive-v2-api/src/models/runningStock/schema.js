const { z } = require('zod')

const RunningStockIdSchema = z.number().int().positive()
const OrganizationIdSchema = z.number().int().positive()

const RunningStockRowSchema = z.object({
  id: RunningStockIdSchema,
  organization_id: OrganizationIdSchema,
  origin_id: z.number().int().positive(),
  ingredient_id: z.number().int().positive(),
  qty: z.coerce.number(),
  unit: z.string(),
  created_at: z.string().optional().nullable(),
  updated_at: z.string().optional().nullable(),
  deleted_at: z.string().optional().nullable(),
})

const RunningStockListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(200).default(50),
  organization_id: z.coerce.number().int().positive().optional(),
  origin_id: z.coerce.number().int().positive().optional(),
  ingredient_id: z.coerce.number().int().positive().optional(),
})

module.exports = {
  RunningStockIdSchema,
  RunningStockRowSchema,
  RunningStockListQuerySchema,
}
