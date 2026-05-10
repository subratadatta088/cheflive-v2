const { z } = require('zod')
const { PurchaseItemNestedCreateSchema } = require('../purchaseItem/schema')

const PurchaseIdSchema = z.number().int().positive()
const OrganizationIdSchema = z.number().int().positive()

const PurchaseCreateSchema = z
  .object({
    organization_id: OrganizationIdSchema,
    origin_id: z.number().int().positive(),
    transfer_to: z.number().int().positive().optional(),
    date: z.string().min(1),
    note: z.string().optional(),
    items: z.array(PurchaseItemNestedCreateSchema).optional(),
  })
  .refine((data) => !data.transfer_to || Number(data.transfer_to) !== Number(data.origin_id), {
    message: 'transfer_to must differ from origin_id',
    path: ['transfer_to'],
  })

/** Server-only: set from authenticated user; never accept from untrusted client without stripping in controller. */
const PurchaseCreateInternalSchema = PurchaseCreateSchema.extend({
  created_by: z.number().int().positive().nullable().optional(),
})

const PurchaseUpdateSchema = z.object({
  origin_id: z.number().int().positive().optional(),
  date: z.string().min(1).optional(),
  note: z.string().nullable().optional(),
})

const PurchaseRowSchema = z.object({
  id: PurchaseIdSchema,
  organization_id: OrganizationIdSchema,
  origin_id: z.number().int().positive(),
  date: z.string(),
  note: z.string().nullable().optional(),
  created_by: z.number().int().positive().nullable().optional(),
  created_at: z.string().optional().nullable(),
  updated_at: z.string().optional().nullable(),
  deleted_at: z.string().optional().nullable(),
})

/** Row returned from API when purchase is joined with `origins` (list/getById). */
const PurchaseApiRowSchema = PurchaseRowSchema.extend({
  origin_name: z.string().nullable().optional(),
  origin_type: z.string().nullable().optional(),
  /** Sum of line extended amounts: Σ(qty × unit_price); lines without unit_price contribute 0. */
  subtotal: z.number().optional(),
})

const PurchaseListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  q: z.string().min(1).optional(),
  origin_id: z.coerce.number().int().positive().optional(),
  organization_id: z.coerce.number().int().positive().optional(),
})

module.exports = {
  PurchaseIdSchema,
  PurchaseCreateSchema,
  PurchaseCreateInternalSchema,
  PurchaseUpdateSchema,
  PurchaseRowSchema,
  PurchaseApiRowSchema,
  PurchaseListQuerySchema,
}
