const { z } = require('zod')
const { BooleanFlagSchema } = require('../../utils/zod')
const { UnitConversionRowSchema } = require('../unitConversion/schema')

const IngredientIdSchema = z.number().int().positive()
const OrganizationIdSchema = z.number().int().positive()
const CategoryIdSchema = z.number().int().positive()
const ItemCodeSchema = z.coerce.number().int().positive()

const IngredientCreateSchema = z.object({
  organization_id: OrganizationIdSchema,
  category_id: CategoryIdSchema,
  item_code: ItemCodeSchema.optional(),
  name: z.string().min(1),
  unit: z.string().min(1),
  base_price: z.number().finite().optional(),
  tags: z.array(z.string()).optional(),
  is_active: z.boolean().optional(),
})

const IngredientUpdateSchema = z.object({
  category_id: CategoryIdSchema.optional(),
  item_code: ItemCodeSchema.nullable().optional(),
  name: z.string().min(1).optional(),
  unit: z.string().min(1).optional(),
  base_price: z.number().finite().nullable().optional(),
  tags: z.array(z.string()).nullable().optional(),
  is_active: z.boolean().optional(),
})

const IngredientRowSchema = z.object({
  id: IngredientIdSchema,
  organization_id: OrganizationIdSchema,
  category_id: CategoryIdSchema,
  category_name: z.string().optional().nullable(),
  item_code: z.number().int().positive().optional().nullable(),
  name: z.string(),
  unit: z.string(),
  base_price: z.number().nullable().optional(),
  tags: z.any().optional(),
  is_active: z.number().int().optional().nullable(),
  created_at: z.string().optional().nullable(),
  updated_at: z.string().optional().nullable(),
  deleted_at: z.string().optional().nullable(),
  unit_conversions: z.array(UnitConversionRowSchema).optional(),
})

const IngredientListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  q: z.string().min(1).optional(),
  category_ids: z
    .preprocess((v) => {
      if (v === undefined || v === null || v === '') return undefined
      const parts = Array.isArray(v) ? v : [v]
      const flat = parts
        .flatMap((x) => String(x ?? '').split(','))
        .map((s) => s.trim())
        .filter(Boolean)
      if (!flat.length) return undefined
      return flat
    }, z.array(z.coerce.number().int().positive()).nonempty())
    .optional(),
  ids: z
    .preprocess((v) => {
      if (v === undefined || v === null || v === '') return undefined
      const parts = Array.isArray(v) ? v : [v]
      const flat = parts
        .flatMap((x) => String(x ?? '').split(','))
        .map((s) => s.trim())
        .filter(Boolean)
      if (!flat.length) return undefined
      return flat
    }, z.array(z.coerce.number().int().positive()).nonempty())
    .optional(),
  is_active: BooleanFlagSchema.optional(),
})

module.exports = {
  IngredientIdSchema,
  IngredientCreateSchema,
  IngredientUpdateSchema,
  IngredientRowSchema,
  IngredientListQuerySchema,
}

