const { z } = require('zod')

const RunningStockIdSchema = z.number().int().positive()
const OrganizationIdSchema = z.number().int().positive()

const optionalQty = z.union([z.coerce.number(), z.null()]).optional()
const optionalUnit = z.union([z.string(), z.null()]).optional()

const RunningStockRowSchema = z.object({
  id: RunningStockIdSchema,
  organization_id: OrganizationIdSchema,
  origin_id: z.number().int().positive(),
  ingredient_id: z.number().int().positive(),
  qty: z.coerce.number(),
  unit: z.string(),
  opening_stock_qty: optionalQty,
  opening_stock_unit: optionalUnit,
  reorder_threshold_qty: optionalQty,
  reorder_threshold_unit: optionalUnit,
  minimum_reorder_qty: optionalQty,
  minimum_reorder_unit: optionalUnit,
  created_by: z.number().int().positive().nullable().optional(),
  created_at: z.string().optional().nullable(),
  updated_at: z.string().optional().nullable(),
  deleted_at: z.string().optional().nullable(),
})

const RunningStockListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  /** Aligned with GET /ingredients/:id/running-stock (default up to 1000 rows per ingredient). */
  limit: z.coerce.number().int().positive().max(1000).default(50),
  organization_id: z.coerce.number().int().positive().optional(),
  origin_id: z.coerce.number().int().positive().optional(),
  ingredient_id: z.coerce.number().int().positive().optional(),
})

const RunningStockConfigQuerySchema = z.object({
  ingredient_id: z.coerce.number().int().positive(),
  origin_id: z.coerce.number().int().positive(),
  organization_id: z.coerce.number().int().positive().optional(),
})

const configQtyField = z
  .union([z.coerce.number(), z.null()])
  .optional()
  .transform((v) => (v === undefined ? undefined : v === null ? null : Number(v)))

const RunningStockConfigUpsertSchema = z.object({
  ingredient_id: z.coerce.number().int().positive(),
  origin_id: z.coerce.number().int().positive(),
  organization_id: z.coerce.number().int().positive().optional(),
  opening_stock_qty: configQtyField,
  reorder_threshold_qty: configQtyField,
  minimum_reorder_qty: configQtyField,
})

module.exports = {
  RunningStockIdSchema,
  RunningStockRowSchema,
  RunningStockListQuerySchema,
  RunningStockConfigQuerySchema,
  RunningStockConfigUpsertSchema,
}
