const { z } = require('zod')

const PreparationItemIdSchema = z.number().int().positive()
const OrganizationIdSchema = z.number().int().positive()
const PreparationIdSchema = z.number().int().positive()
const IngredientIdSchema = z.number().int().positive()

const PreparationItemCreateSchema = z.object({
  organization_id: OrganizationIdSchema,
  preparation_id: PreparationIdSchema,
  ingredient_id: IngredientIdSchema,
  qty: z.number().finite().optional(),
  unit: z.string().min(1).optional(),
})

const PreparationItemNestedCreateSchema = z.object({
  ingredient_id: IngredientIdSchema,
  qty: z.number().finite().optional(),
  unit: z.string().min(1).optional(),
})

const PreparationItemUpdateSchema = z.object({
  qty: z.number().finite().nullable().optional(),
  unit: z.string().min(1).nullable().optional(),
})

const PreparationItemRowSchema = z.object({
  id: PreparationItemIdSchema,
  organization_id: OrganizationIdSchema,
  preparation_id: PreparationIdSchema.nullable().optional(),
  ingredient_id: IngredientIdSchema.nullable().optional(),
  qty: z.number().nullable().optional(),
  unit: z.string().nullable().optional(),
  created_at: z.string().optional().nullable(),
  updated_at: z.string().optional().nullable(),
  deleted_at: z.string().optional().nullable(),
})

const PreparationItemListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  preparation_id: z.coerce.number().int().positive().optional(),
  organization_id: z.coerce.number().int().positive().optional(),
})

module.exports = {
  PreparationItemIdSchema,
  PreparationItemCreateSchema,
  PreparationItemNestedCreateSchema,
  PreparationItemUpdateSchema,
  PreparationItemRowSchema,
  PreparationItemListQuerySchema,
}

