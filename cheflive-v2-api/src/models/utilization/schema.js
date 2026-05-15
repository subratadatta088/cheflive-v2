const { z } = require('zod')
const { UtilizationItemNestedCreateSchema } = require('../utilizationItem/schema')

const UtilizationIdSchema = z.number().int().positive()
const OrganizationIdSchema = z.number().int().positive()

const UtilizationCreateSchema = z
  .object({
    organization_id: OrganizationIdSchema,
    origin_id: z.number().int().positive(),
    date: z.string().min(1),
    preparation_id: z.number().int().positive().optional().nullable(),
    type: z.string().optional().nullable(),
    qty: z.coerce.number().positive().optional().nullable(),
    unit: z.string().min(1).optional().nullable(),
    note: z.string().optional(),
    items: z.array(UtilizationItemNestedCreateSchema).optional(),
  })
  .superRefine((data, ctx) => {
    const items = Array.isArray(data.items) ? data.items : []
    const hasItems = items.length > 0
    const hasPrep =
      data.preparation_id !== undefined &&
      data.preparation_id !== null &&
      Number.isFinite(Number(data.preparation_id)) &&
      Number(data.preparation_id) > 0
    const hasHeaderQty =
      data.qty !== undefined && data.qty !== null && Number.isFinite(Number(data.qty)) && Number(data.qty) > 0
    const headerUnit = data.unit != null ? String(data.unit).trim() : ''

    if (hasPrep && (!hasHeaderQty || !headerUnit)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Utilization qty and unit are required for preparations.',
        path: ['qty'],
      })
    }

    if (hasItems) return

    if (!hasHeaderQty || !headerUnit) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Provide line items or utilization qty and unit.',
        path: ['qty'],
      })
    }
  })

const UtilizationCreateInternalSchema = UtilizationCreateSchema.extend({
  created_by: z.number().int().positive().nullable().optional(),
})

const UtilizationUpdateSchema = z
  .object({
    origin_id: z.number().int().positive().optional(),
    date: z.string().min(1).optional(),
    preparation_id: z.number().int().positive().optional().nullable(),
    type: z.string().optional().nullable(),
    qty: z.coerce.number().positive().optional().nullable(),
    unit: z.string().min(1).optional().nullable(),
    note: z.string().nullable().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.qty === undefined && data.unit === undefined) return
    const hasQty =
      data.qty !== undefined &&
      data.qty !== null &&
      Number.isFinite(Number(data.qty)) &&
      Number(data.qty) > 0
    const unit = data.unit != null ? String(data.unit).trim() : ''
    if (hasQty && !unit) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Unit is required when qty is set.',
        path: ['unit'],
      })
    }
    if (unit && !hasQty) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Qty is required when unit is set.',
        path: ['qty'],
      })
    }
  })

const UtilizationRowSchema = z.object({
  id: UtilizationIdSchema,
  organization_id: OrganizationIdSchema,
  origin_id: z.number().int().positive().optional().nullable(),
  type: z.string().nullable().optional(),
  preparation_id: z.number().int().positive().nullable().optional(),
  menu_id: z.number().int().positive().nullable().optional(),
  qty: z.number().nullable().optional(),
  unit: z.string().nullable().optional(),
  date: z.string().optional().nullable(),
  note: z.string().nullable().optional(),
  created_by: z.number().int().positive().nullable().optional(),
  created_at: z.string().optional().nullable(),
  updated_at: z.string().optional().nullable(),
  deleted_at: z.string().optional().nullable(),
})

const UtilizationApiRowSchema = UtilizationRowSchema.extend({
  origin_name: z.string().nullable().optional(),
  preparation_name: z.string().nullable().optional(),
})

const UtilizationListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  q: z.string().min(1).optional(),
  origin_id: z.coerce.number().int().positive().optional(),
  organization_id: z.coerce.number().int().positive().optional(),
})

module.exports = {
  UtilizationIdSchema,
  UtilizationCreateSchema,
  UtilizationCreateInternalSchema,
  UtilizationUpdateSchema,
  UtilizationRowSchema,
  UtilizationApiRowSchema,
  UtilizationListQuerySchema,
}
