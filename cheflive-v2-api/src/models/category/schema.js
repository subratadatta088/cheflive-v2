const { z } = require('zod')
const { BooleanFlagSchema } = require('../../utils/zod')

const CategoryIdSchema = z.number().int().positive()
const OrganizationIdSchema = z.number().int().positive()

const CategoryCreateSchema = z.object({
  organization_id: OrganizationIdSchema,
  name: z.string().min(1),
  is_active: z.boolean().optional(),
})

const CategoryUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  is_active: z.boolean().optional(),
})

const CategoryRowSchema = z.object({
  id: CategoryIdSchema,
  organization_id: OrganizationIdSchema,
  name: z.string(),
  is_active: z.number().int().optional().nullable(),
  created_at: z.string().optional().nullable(),
  updated_at: z.string().optional().nullable(),
  deleted_at: z.string().optional().nullable(),
})

const CategoryListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
  q: z.string().min(1).optional(),
  is_active: BooleanFlagSchema.optional(),
  organization_id: z.coerce.number().int().positive().optional(),
  deleted_at: z.string().optional().nullable(),
})

module.exports = {
  CategoryIdSchema,
  CategoryCreateSchema,
  CategoryUpdateSchema,
  CategoryRowSchema,
  CategoryListQuerySchema,
}

