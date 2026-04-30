const { z } = require('zod')

const OriginIdSchema = z.number().int().positive()
const OrganizationIdSchema = z.number().int().positive()

const OriginCreateSchema = z.object({
  organization_id: OrganizationIdSchema,
  name: z.string().min(1),
  type: z.string().min(1),
  is_active: z.boolean().optional(),
  is_default: z.boolean().optional(),
})

const OriginUpdateSchema = z.object({
  organization_id: OrganizationIdSchema.optional(),
  name: z.string().min(1).optional(),
  type: z.string().min(1).optional(),
  is_active: z.boolean().optional(),
  is_default: z.boolean().optional(),
})

const OriginRowSchema = z.object({
  id: OriginIdSchema,
  organization_id: OrganizationIdSchema,
  name: z.string(),
  type: z.string(),
  is_active: z.number().int().optional().nullable(),
  is_default: z.number().int().optional().nullable(),
  created_at: z.string().optional().nullable(),
  updated_at: z.string().optional().nullable(),
  deleted_at: z.string().optional().nullable(),
})

const OriginListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  q: z.string().min(1).optional(),
  type: z.string().min(1).optional(),
  is_active: z
    .union([z.literal('0'), z.literal('1'), z.literal(0), z.literal(1), z.boolean()])
    .optional(),
  organization_id: z.coerce.number().int().positive().optional(),
})

module.exports = {
  OriginIdSchema,
  OriginCreateSchema,
  OriginUpdateSchema,
  OriginRowSchema,
  OriginListQuerySchema,
}

