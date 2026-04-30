const { z } = require('zod')

const UnitConversionIdSchema = z.number().int().positive()
const OrganizationIdSchema = z.number().int().positive()
const IngredientIdSchema = z.number().int().positive()

const UnitConversionCreateSchema = z.object({
  organization_id: OrganizationIdSchema,
  ingredient_id: IngredientIdSchema,
  from_unit: z.string().min(1),
  to_unit: z.string().min(1),
  factor: z.number().finite().positive(),
})

const UnitConversionUpdateSchema = z.object({
  from_unit: z.string().min(1).optional(),
  to_unit: z.string().min(1).optional(),
  factor: z.number().finite().positive().optional(),
})

const UnitConversionRowSchema = z.object({
  id: UnitConversionIdSchema,
  organization_id: OrganizationIdSchema,
  ingredient_id: IngredientIdSchema.nullable().optional(),
  from_unit: z.string().nullable().optional(),
  to_unit: z.string().nullable().optional(),
  factor: z.number().nullable().optional(),
  created_at: z.string().optional().nullable(),
  updated_at: z.string().optional().nullable(),
  deleted_at: z.string().optional().nullable(),
})

const UnitConversionListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  ingredient_id: z.coerce.number().int().positive().optional(),
  organization_id: z.coerce.number().int().positive().optional(),
})

module.exports = {
  UnitConversionIdSchema,
  UnitConversionCreateSchema,
  UnitConversionUpdateSchema,
  UnitConversionRowSchema,
  UnitConversionListQuerySchema,
}
