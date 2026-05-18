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

const StockListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  q: z.string().min(1).optional(),
  organization_id: z.coerce.number().int().positive().optional(),
  origin_ids: idArrayFromQuery,
  ingredient_ids: idArrayFromQuery,
})

const StockOriginBreakdownSchema = z.object({
  origin_id: z.number().int().positive(),
  origin_name: z.string(),
  qty: z.coerce.number(),
  unit: z.string(),
})

const StockListItemSchema = z.object({
  ingredient_id: z.number().int().positive(),
  ingredient_name: z.string(),
  item_code: z.number().int().positive().nullable().optional(),
  unit: z.string(),
  category_id: z.number().int().positive(),
  category_name: z.string().optional().nullable(),
  current_qty: z.coerce.number(),
  origins: z.array(StockOriginBreakdownSchema).optional(),
})

module.exports = {
  StockListQuerySchema,
  StockListItemSchema,
  StockOriginBreakdownSchema,
}
