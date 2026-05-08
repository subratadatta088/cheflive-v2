const { z } = require('zod')

const StockTransitionStateIdSchema = z.number().int().positive()
const OrganizationIdSchema = z.number().int().positive()

const SourceTypeSchema = z.enum([
  'transfer_in',
  'transfer_out',
  'transfer_in_reversal',
  'transfer_out_reversal',
  'purchase_in',
  'purchase_in_reversal',
])

const StockTransitionStateRowSchema = z.object({
  id: StockTransitionStateIdSchema,
  organization_id: OrganizationIdSchema,
  origin_id: z.number().int().positive(),
  ingredient_id: z.number().int().positive(),
  unit: z.string(),
  qty_before: z.coerce.number(),
  qty_delta: z.coerce.number(),
  qty_after: z.coerce.number(),
  source_type: SourceTypeSchema,
  source_transfer_id: z.number().int().positive().optional().nullable(),
  source_transfer_item_id: z.number().int().positive().optional().nullable(),
  source_purchase_id: z.number().int().positive().optional().nullable(),
  source_purchase_item_id: z.number().int().positive().optional().nullable(),
  occurred_at: z.string(),
  created_at: z.string().optional().nullable(),
  created_by: z.number().int().positive().optional().nullable(),
})

const StockTransitionStateListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(200).default(50),
  organization_id: z.coerce.number().int().positive().optional(),
  origin_id: z.coerce.number().int().positive().optional(),
  ingredient_id: z.coerce.number().int().positive().optional(),
  source_transfer_id: z.coerce.number().int().positive().optional(),
  source_type: SourceTypeSchema.optional(),
  from_date: z.string().min(1).optional(),
  to_date: z.string().min(1).optional(),
})

module.exports = {
  StockTransitionStateIdSchema,
  StockTransitionStateRowSchema,
  StockTransitionStateListQuerySchema,
  SourceTypeSchema,
}
