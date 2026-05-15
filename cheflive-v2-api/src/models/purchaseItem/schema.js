const { z } = require('zod')

const PurchaseItemIdSchema = z.number().int().positive()
const OrganizationIdSchema = z.number().int().positive()
const PurchaseIdSchema = z.number().int().positive()
const IngredientIdSchema = z.number().int().positive()

const PurchaseItemNestedCreateSchema = z.object({
  ingredient_id: IngredientIdSchema,
  qty: z.number().finite().positive(),
  unit: z.string().min(1).optional(),
  unit_price: z.number().finite().nonnegative().optional(),
})

const PurchaseItemCreateSchema = z.object({
  organization_id: OrganizationIdSchema,
  purchase_id: PurchaseIdSchema,
  ingredient_id: IngredientIdSchema,
  qty: z.number().finite().positive(),
  unit: z.string().min(1).optional(),
  unit_price: z.number().finite().nonnegative().optional(),
})

const PurchaseItemUpdateSchema = z.object({
  qty: z.number().finite().positive().optional(),
  unit: z.string().min(1).nullable().optional(),
  unit_price: z.number().finite().nonnegative().nullable().optional(),
})

const PurchaseItemRowSchema = z.object({
  id: PurchaseItemIdSchema,
  organization_id: OrganizationIdSchema,
  purchase_id: PurchaseIdSchema.nullable().optional(),
  ingredient_id: IngredientIdSchema.nullable().optional(),
  qty: z.number(),
  unit: z.string().nullable().optional(),
  unit_price: z.number().nullable().optional(),
  created_by: z.number().int().positive().nullable().optional(),
  created_at: z.string().optional().nullable(),
  updated_at: z.string().optional().nullable(),
  deleted_at: z.string().optional().nullable(),
})

/** Row when `purchase_items` is joined with `ingredients` (list/getById, all-items). */
const PurchaseItemApiRowSchema = PurchaseItemRowSchema.extend({
  ingredient_name: z.string().nullable().optional(),
  /** Alias of unit_price on flat all-items responses. */
  price: z.number().nullable().optional(),
  /** Line extended amount from SQL: qty × price. */
  subtotal: z.number().nullable().optional(),
  ingredient_default_unit: z.string().nullable().optional(),
  item_code: z.number().int().nullable().optional(),
})

const PurchaseItemListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  purchase_id: z.coerce.number().int().positive().optional(),
  organization_id: z.coerce.number().int().positive().optional(),
})

module.exports = {
  PurchaseItemIdSchema,
  PurchaseItemNestedCreateSchema,
  PurchaseItemCreateSchema,
  PurchaseItemUpdateSchema,
  PurchaseItemRowSchema,
  PurchaseItemApiRowSchema,
  PurchaseItemListQuerySchema,
}
