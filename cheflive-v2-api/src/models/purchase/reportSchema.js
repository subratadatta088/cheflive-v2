const { z } = require('zod')

const MAX_REPORT_RANGE_DAYS = 183

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

function parseIsoDateOnly(value) {
  const s = String(value ?? '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  const d = new Date(`${s}T00:00:00.000Z`)
  if (Number.isNaN(d.getTime())) return null
  return d
}

function daysBetweenInclusive(from, to) {
  const ms = to.getTime() - from.getTime()
  return Math.floor(ms / 86400000) + 1
}

const dateRangeRefine = (data, ctx) => {
  const from = parseIsoDateOnly(data.from_date)
  const to = parseIsoDateOnly(data.to_date)
  if (!from) {
    ctx.addIssue({ code: 'custom', message: 'from_date must be YYYY-MM-DD', path: ['from_date'] })
    return
  }
  if (!to) {
    ctx.addIssue({ code: 'custom', message: 'to_date must be YYYY-MM-DD', path: ['to_date'] })
    return
  }
  if (to < from) {
    ctx.addIssue({ code: 'custom', message: 'to_date must be on or after from_date', path: ['to_date'] })
    return
  }
  const span = daysBetweenInclusive(from, to)
  if (span > MAX_REPORT_RANGE_DAYS) {
    ctx.addIssue({
      code: 'custom',
      message: `Date range cannot exceed ${MAX_REPORT_RANGE_DAYS} days (6 months)`,
      path: ['to_date'],
    })
  }
}

const PurchaseReportRequestFieldsSchema = z.object({
  organization_id: z.coerce.number().int().positive().optional(),
  from_date: z.string().min(1),
  to_date: z.string().min(1),
  branch_id: z.coerce.number().int().positive().optional(),
  vendor_id: z.coerce.number().int().positive().optional(),
  ingredient_ids: idArrayFromQuery,
  category_ids: idArrayFromQuery,
})

/** POST body for purchase report APIs (dates required). */
const PurchaseReportRequestSchema = PurchaseReportRequestFieldsSchema.superRefine(dateRangeRefine)

/** Internal filter passed to repository (includes organization_id). */
const PurchaseReportFilterSchema = PurchaseReportRequestFieldsSchema.extend({
  organization_id: z.coerce.number().int().positive(),
}).superRefine(dateRangeRefine)

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

const PurchaseReportIngredientQuerySchema = PurchaseReportFilterSchema.extend({
  sort_by: PurchaseReportIngredientSortBySchema.default('total_subtotal'),
  sort_order: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(500).default(50),
})

const PurchaseReportTimelineQuerySchema = PurchaseReportFilterSchema

/** Raw SQL row from ingredient analytics query. */
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
  rate_variance: z.coerce.number().nullable().optional(),
  last_purchase_date: z.string().nullable().optional(),
  last_purchase_qty: z.coerce.number().nullable().optional(),
  last_purchase_rate: z.coerce.number().nullable().optional(),
  last_purchase_unit: z.string().nullable().optional(),
  purchase_frequency_days_avg: z.coerce.number().nullable().optional(),
  highest_rate_date: z.string().nullable().optional(),
  highest_rate_qty: z.coerce.number().nullable().optional(),
  highest_rate_unit: z.string().nullable().optional(),
  lowest_rate_date: z.string().nullable().optional(),
  lowest_rate_qty: z.coerce.number().nullable().optional(),
  lowest_rate_unit: z.string().nullable().optional(),
})

const PurchaseReportTimelineRowSchema = z.object({
  purchase_day: z.string(),
  total_purchase_amount: z.coerce.number(),
  total_purchase_entries: z.coerce.number().int().nonnegative(),
  total_purchase_items: z.coerce.number().int().nonnegative(),
  total_quantity: z.coerce.number(),
})

/** API analytics table row. */
const PurchaseReportAnalyticsRowSchema = z.object({
  ingredient_id: z.number().int().positive(),
  ingredient_name: z.string(),
  unit: z.string(),
  total_quantity: z.coerce.number(),
  total_spend: z.coerce.number(),
  purchase_frequency: z.coerce.number().int().nonnegative(),
  purchase_frequency_days_avg: z.coerce.number().nullable().optional(),
  avg_rate: z.coerce.number().nullable().optional(),
  highest_rate: z.coerce.number().nullable().optional(),
  lowest_rate: z.coerce.number().nullable().optional(),
  rate_variance: z.coerce.number().nullable().optional(),
  last_purchase_date: z.string().nullable().optional(),
  last_purchase_qty: z.coerce.number().nullable().optional(),
  last_purchase_rate: z.coerce.number().nullable().optional(),
  last_purchase_unit: z.string().nullable().optional(),
  spend_percentage: z.coerce.number().nullable().optional(),
})

const PurchaseReportGlobalTotalsSchema = z.object({
  total_purchase_amount: z.coerce.number(),
  total_purchase_entries: z.coerce.number().int().nonnegative(),
  total_unique_ingredients: z.coerce.number().int().nonnegative(),
})

module.exports = {
  MAX_REPORT_RANGE_DAYS,
  PurchaseReportRequestFieldsSchema,
  PurchaseReportRequestSchema,
  PurchaseReportFilterSchema,
  PurchaseReportIngredientQuerySchema,
  PurchaseReportTimelineQuerySchema,
  PurchaseReportIngredientRowSchema,
  PurchaseReportTimelineRowSchema,
  PurchaseReportAnalyticsRowSchema,
  PurchaseReportGlobalTotalsSchema,
  PurchaseReportIngredientSortBySchema,
}
