const { z } = require('zod')

const idArrayFromQuery = z
  .preprocess((v) => {
    if (v === undefined || v === null || v === '') return undefined
    const parts = Array.isArray(v) ? v : [v]
    const flat = parts
      .flatMap((x) => String(x ?? '').split(','))
      .map((s) => s.trim())
      .filter(Boolean)
    if (!flat.length) return undefined
    return flat
  }, z.array(z.coerce.number().int().positive()).nonempty())
  .optional()

/** Shared date-range + optional scope filters for purchase reports. */
const PurchaseReportBaseFilterSchema = z.object({
  organization_id: z.coerce.number().int().positive(),
  from_date: z.string().min(1),
  to_date: z.string().min(1),
  branch_id: z.coerce.number().int().positive().optional(),
  vendor_id: z.coerce.number().int().positive().optional(),
  ingredient_ids: idArrayFromQuery,
  category_ids: idArrayFromQuery,
})

const PurchaseReportIngredientSortBySchema = z.enum([
  'ingredient_name',
  'total_purchase_entries',
  'total_quantity',
  'total_subtotal',
  'avg_rate',
  'highest_rate',
  'lowest_rate',
  'last_purchase_date',
  'purchase_frequency_days_avg',
])

const PurchaseReportIngredientQuerySchema = PurchaseReportBaseFilterSchema.extend({
  sort_by: PurchaseReportIngredientSortBySchema.default('total_subtotal'),
  sort_order: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(500).default(50),
})

const PurchaseReportTimelineQuerySchema = PurchaseReportBaseFilterSchema

const PurchaseReportIngredientRowSchema = z.object({
  ingredient_id: z.number().int().positive(),
  ingredient_name: z.string(),
  unit: z.string(),
  total_purchase_entries: z.coerce.number().int().nonnegative(),
  total_quantity: z.coerce.number(),
  total_subtotal: z.coerce.number(),
  avg_rate: z.coerce.number().nullable().optional(),
  highest_rate: z.coerce.number().nullable().optional(),
  lowest_rate: z.coerce.number().nullable().optional(),
  last_purchase_date: z.string().nullable().optional(),
  last_purchase_qty: z.coerce.number().nullable().optional(),
  last_purchase_rate: z.coerce.number().nullable().optional(),
  purchase_frequency_days_avg: z.coerce.number().nullable().optional(),
})

const PurchaseReportTimelineRowSchema = z.object({
  purchase_day: z.string(),
  total_purchase_amount: z.coerce.number(),
  total_purchase_entries: z.coerce.number().int().nonnegative(),
  total_purchase_items: z.coerce.number().int().nonnegative(),
  total_quantity: z.coerce.number(),
})

module.exports = {
  PurchaseReportBaseFilterSchema,
  PurchaseReportIngredientQuerySchema,
  PurchaseReportTimelineQuerySchema,
  PurchaseReportIngredientRowSchema,
  PurchaseReportTimelineRowSchema,
  PurchaseReportIngredientSortBySchema,
}
