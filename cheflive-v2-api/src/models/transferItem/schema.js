const { z } = require('zod')

const TransferItemIdSchema = z.number().int().positive()
const TransferIdSchema = z.number().int().positive()
const OrganizationIdSchema = z.number().int().positive()

const TransferItemNestedCreateSchema = z.object({
  ingredient_id: z.number().int().positive(),
  qty: z.coerce.number().positive(),
  /** Unit the qty is expressed in; must match ingredient base or a conversion pair. */
  unit: z.string().min(1),
})

const TransferItemCreateSchema = z.object({
  organization_id: OrganizationIdSchema,
  transfer_id: TransferIdSchema,
  ingredient_id: z.number().int().positive(),
  qty: z.coerce.number().positive(),
  unit: z.string().min(1),
})

/** Server-only audit; set from JWT user in TransferItemService — not part of public API body. */
const TransferItemCreateInternalSchema = TransferItemCreateSchema.extend({
  created_by: z.number().int().positive().nullable().optional(),
})

const TransferItemUpdateSchema = z.object({
  qty: z.coerce.number().positive().optional(),
  unit: z.string().min(1).optional(),
})

const TransferItemRowSchema = z.object({
  id: TransferItemIdSchema,
  organization_id: OrganizationIdSchema,
  transfer_id: z.number().int().positive().optional().nullable(),
  ingredient_id: z.number().int().positive().optional().nullable(),
  qty: z.coerce.number(),
  unit: z.coerce.string().optional().nullable(),
  created_by: z.number().int().positive().nullable().optional(),
  created_at: z.string().optional().nullable(),
  updated_at: z.string().optional().nullable(),
  deleted_at: z.string().optional().nullable(),
})

const TransferItemListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  organization_id: z.coerce.number().int().positive().optional(),
  transfer_id: z.coerce.number().int().positive().optional(),
})

module.exports = {
  TransferItemIdSchema,
  TransferIdSchema,
  TransferItemNestedCreateSchema,
  TransferItemCreateSchema,
  TransferItemCreateInternalSchema,
  TransferItemUpdateSchema,
  TransferItemRowSchema,
  TransferItemListQuerySchema,
}

