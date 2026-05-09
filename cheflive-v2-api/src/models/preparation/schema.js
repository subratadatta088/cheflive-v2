const { z } = require('zod')
const { PreparationItemNestedCreateSchema } = require('../preparationItem/schema')
const { BooleanFlagSchema } = require('../../utils/zod')

const PreparationIdSchema = z.number().int().positive()
const OrganizationIdSchema = z.number().int().positive()

const PreparationCreateSchema = z.object({
  organization_id: OrganizationIdSchema,
  name: z.string().min(1),
  type: z.string().min(1).optional(),
  qty: z.number().finite().optional(),
  unit: z.string().min(1).optional(),
  tags: z.array(z.string()).optional(),
  is_active: z.boolean().optional(),
  items: z.array(PreparationItemNestedCreateSchema).optional(),
})

const PreparationUpdateSchema = z.object({
  organization_id: OrganizationIdSchema.optional(),
  name: z.string().min(1).optional(),
  type: z.string().min(1).nullable().optional(),
  qty: z.number().finite().nullable().optional(),
  unit: z.string().min(1).nullable().optional(),
  tags: z.array(z.string()).nullable().optional(),
  is_active: z.boolean().optional(),
})

const PreparationRowSchema = z.object({
  id: PreparationIdSchema,
  organization_id: OrganizationIdSchema,
  name: z.string(),
  type: z.string().nullable().optional(),
  qty: z.number().nullable().optional(),
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
  organization_id: z.coerce.number().int().positive().optional(),
})

module.exports = {
  PreparationIdSchema,
  PreparationCreateSchema,
  PreparationUpdateSchema,
  PreparationRowSchema,
  PreparationListQuerySchema,
}

