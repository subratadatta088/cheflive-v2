const { z } = require('zod')

const UserIdSchema = z.number().int().positive()
const OrganizationIdSchema = z.number().int().positive()

const UserCreateSchema = z.object({
  organization_id: OrganizationIdSchema.nullable().optional(),
  username: z.string().min(1),
  password: z.string().min(1),
  name: z.string().min(1).optional(),
})

const UserUpdateSchema = z.object({
  organization_id: OrganizationIdSchema.nullable().optional(),
  username: z.string().min(1).optional(),
  password: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
})

const UserRowSchema = z.object({
  id: UserIdSchema,
  organization_id: OrganizationIdSchema.nullable().optional(),
  username: z.string(),
  password: z.string(),
  name: z.string().nullable().optional(),
  created_at: z.string().optional().nullable(),
  updated_at: z.string().optional().nullable(),
  deleted_at: z.string().optional().nullable(),
})

module.exports = {
  UserIdSchema,
  OrganizationIdSchema,
  UserCreateSchema,
  UserUpdateSchema,
  UserRowSchema,
}
