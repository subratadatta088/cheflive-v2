const { z } = require('zod')

const UtilizationItemIdSchema = z.number().int().positive()
const UtilizationIdSchema = z.number().int().positive()
const OrganizationIdSchema = z.number().int().positive()

const UtilizationItemNestedCreateSchema = z.object({
  ingredient_id: z.number().int().positive(),
  qty: z.coerce.number().positive(),
  unit: z.string().min(1),
})

const UtilizationItemCreateSchema = z.object({
  organization_id: OrganizationIdSchema,
  utilization_id: UtilizationIdSchema,
  ingredient_id: z.number().int().positive(),
  qty: z.coerce.number().positive(),
  unit: z.string().min(1),
})

const UtilizationItemCreateInternalSchema = UtilizationItemCreateSchema.extend({
  created_by: z.number().int().positive().nullable().optional(),
})

const UtilizationItemUpdateSchema = z.object({
  qty: z.coerce.number().positive().optional(),
  unit: z.string().min(1).optional(),
})

const UtilizationItemRowSchema = z.object({
  id: UtilizationItemIdSchema,
  organization_id: OrganizationIdSchema,
  utilization_id: z.number().int().positive().optional().nullable(),
  ingredient_id: z.number().int().positive().optional().nullable(),
  qty: z.coerce.number(),
  unit: z.coerce.string().optional().nullable(),
  created_by: z.number().int().positive().nullable().optional(),
  created_at: z.string().optional().nullable(),
  updated_at: z.string().optional().nullable(),
  deleted_at: z.string().optional().nullable(),
})

const UtilizationItemApiRowSchema = UtilizationItemRowSchema.extend({
  ingredient_name: z.string().nullable().optional(),
})

const UtilizationItemListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  organization_id: z.coerce.number().int().positive().optional(),
  utilization_id: z.coerce.number().int().positive().optional(),
})

module.exports = {
  UtilizationItemIdSchema,
  UtilizationIdSchema,
  UtilizationItemNestedCreateSchema,
  UtilizationItemCreateSchema,
  UtilizationItemCreateInternalSchema,
  UtilizationItemUpdateSchema,
  UtilizationItemRowSchema,
  UtilizationItemApiRowSchema,
  UtilizationItemListQuerySchema,
}
