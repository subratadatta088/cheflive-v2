const { z } = require('zod')
const { PreparationItemNestedCreateSchema } = require('../preparationItem/schema')
const { BooleanFlagSchema } = require('../../utils/zod')

const PreparationIdSchema = z.number().int().positive()
const OrganizationIdSchema = z.number().int().positive()

const PreparationCreateSchema = z.object({
  organization_id: OrganizationIdSchema,
  name: z.string().min(1),
  type: z.string().min(1).optional(),
  unit: z.string().min(1),
  tags: z.array(z.string()).optional(),
  is_active: z.boolean().optional(),
  items: z.array(PreparationItemNestedCreateSchema).optional(),
})

const PreparationFieldsSchema = z.object({
  name: z.string().min(1),
  type: z.string().min(1).optional(),
  unit: z.string().min(1),
  tags: z.array(z.string()).optional(),
  is_active: z.boolean().optional(),
})

const PreparationUpdateSchema = z.object({
  organization_id: OrganizationIdSchema.optional(),
  name: z.string().min(1).optional(),
  type: z.string().min(1).nullable().optional(),
  unit: z.string().min(1).nullable().optional(),
  tags: z.array(z.string()).nullable().optional(),
  is_active: z.boolean().optional(),
  items: z.array(PreparationItemNestedCreateSchema).optional(),
})

/** POST/PATCH body: { preparation: {...}, items: [...] } */
const PreparationWriteBodySchema = z.object({
  preparation: PreparationFieldsSchema.partial().optional(),
  items: z.array(PreparationItemNestedCreateSchema).optional(),
})

const PreparationRowSchema = z.object({
  id: PreparationIdSchema,
  organization_id: OrganizationIdSchema,
  name: z.string(),
  type: z.string().nullable().optional(),
  unit: z.string().nullable().optional(),
  tags: z.any().optional(),
  is_active: z.number().int().optional().nullable(),
  created_at: z.string().optional().nullable(),
  updated_at: z.string().optional().nullable(),
  deleted_at: z.string().optional().nullable(),
})

const PreparationListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  q: z.string().min(1).optional(),
  type: z.string().min(1).optional(),
  is_active: BooleanFlagSchema.optional(),
  from_date: z.string().min(1).optional(),
  to_date: z.string().min(1).optional(),
  has_ingredients: BooleanFlagSchema.optional(),
  organization_id: z.coerce.number().int().positive().optional(),
})

module.exports = {
  PreparationIdSchema,
  PreparationFieldsSchema,
  PreparationCreateSchema,
  PreparationUpdateSchema,
  PreparationWriteBodySchema,
  PreparationRowSchema,
  PreparationListQuerySchema,
}

