const { z } = require('zod')

const TransferItemIdSchema = z.number().int().positive()
const TransferIdSchema = z.number().int().positive()
const OrganizationIdSchema = z.number().int().positive()

const TransferItemNestedCreateSchema = z.object({
  ingredient_id: z.number().int().positive(),
  qty: z.coerce.number().positive(),
  unit_id: z.number().int().positive().optional().nullable(),
})

const TransferItemCreateSchema = z.object({
  organization_id: OrganizationIdSchema,
  transfer_id: TransferIdSchema,
  ingredient_id: z.number().int().positive(),
  qty: z.coerce.number().positive(),
  unit_id: z.number().int().positive().optional().nullable(),
})

const TransferItemUpdateSchema = z.object({
  qty: z.coerce.number().positive().optional(),
  unit_id: z.number().int().positive().optional().nullable(),
})

const TransferItemRowSchema = z.object({
  id: TransferItemIdSchema,
  organization_id: OrganizationIdSchema,
  transfer_id: z.number().int().positive().optional().nullable(),
  ingredient_id: z.number().int().positive().optional().nullable(),
  qty: z.coerce.number(),
  unit: z.string().optional().nullable(), // legacy column (kept for backward compatibility)
  unit_id: z.number().int().positive().optional().nullable(),
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
  TransferItemUpdateSchema,
  TransferItemRowSchema,
  TransferItemListQuerySchema,
}

