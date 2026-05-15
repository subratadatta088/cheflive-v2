const { z } = require('zod')
const { TransferItemNestedCreateSchema } = require('../transferItem/schema')

const TransferIdSchema = z.number().int().positive()
const OrganizationIdSchema = z.number().int().positive()

const TransferCreateSchema = z.object({
  organization_id: OrganizationIdSchema,
  from_origin_id: z.number().int().positive().optional().nullable(),
  to_origin_id: z.number().int().positive().optional().nullable(),
  from_purchase_id: z.number().int().positive().optional().nullable(),
  to_utilisation_id: z.number().int().positive().optional().nullable(),
  transfer_date: z.string().min(1),
  note: z.string().optional(),
  items: z.array(TransferItemNestedCreateSchema).optional(),
})

/** Applied to nested transfer_items rows; set from JWT user in TransferService. */
const TransferCreateInternalSchema = TransferCreateSchema.extend({
  created_by: z.number().int().positive().nullable().optional(),
})

const TransferUpdateSchema = z.object({
  from_origin_id: z.number().int().positive().optional().nullable(),
  to_origin_id: z.number().int().positive().optional().nullable(),
  from_purchase_id: z.number().int().positive().optional().nullable(),
  to_utilisation_id: z.number().int().positive().optional().nullable(),
  transfer_date: z.string().min(1).optional(),
  note: z.string().nullable().optional(),
  items: z.array(TransferItemNestedCreateSchema).optional(),
})

const TransferRowSchema = z.object({
  id: TransferIdSchema,
  organization_id: OrganizationIdSchema,
  from_origin_id: z.number().int().positive().optional().nullable(),
  to_origin_id: z.number().int().positive().optional().nullable(),
  from_purchase_id: z.number().int().positive().optional().nullable(),
  to_utilisation_id: z.number().int().positive().optional().nullable(),
  transfer_date: z.string().optional().nullable(),
  date: z.string().optional().nullable(), // legacy column (kept for backward compatibility)
  note: z.string().nullable().optional(),
  created_by: z.number().int().positive().nullable().optional(),
  created_at: z.string().optional().nullable(),
  updated_at: z.string().optional().nullable(),
  deleted_at: z.string().optional().nullable(),
})

const TransferListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  q: z.string().min(1).optional(),
  from_origin_id: z.coerce.number().int().positive().optional(),
  to_origin_id: z.coerce.number().int().positive().optional(),
  organization_id: z.coerce.number().int().positive().optional(),
  /** When false (default), hide purchase/utilization-linked system transfers (require both origins). */
  include_system_entry: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((v) => v === true || v === 'true' || v === '1')
    .default(false),
})

/**
 * Body for POST /transfers/grouped-items and POST /transfers/all-items.
 */
const TransferGroupItemsBodySchema = z.object({
  organization_id: z.coerce.number().int().positive().optional(),
  ids: z
    .preprocess((v) => {
      if (v === undefined || v === null || v === '') return []
      const parts = Array.isArray(v) ? v : [v]
      const flat = parts
        .flatMap((x) => String(x ?? '').split(','))
        .map((s) => s.trim())
        .filter(Boolean)
      return flat
    }, z.array(z.coerce.number().int().positive()).max(100))
    .default([]),
})

module.exports = {
  TransferIdSchema,
  TransferCreateSchema,
  TransferCreateInternalSchema,
  TransferUpdateSchema,
  TransferRowSchema,
  TransferListQuerySchema,
  TransferGroupItemsBodySchema,
}

