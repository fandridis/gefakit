import { z } from 'zod'

export const organizationSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1, 'Organization name cannot be empty'),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
})

export const organizationMembershipSchema = z.object({
  id: z.number().int().positive(),
  organization: organizationSchema,
  role: z.enum(['owner', 'member', 'admin']),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
})

export const creatableOrganizationSchema = organizationSchema
  .omit({ id: true, created_at: true, updated_at: true })
  .extend({
    name: z.string()
      .min(1, 'Organization name cannot be empty')
      .max(120, 'Organization name cannot be longer than 120 characters'),
  })

export const updatableOrganizationSchema = creatableOrganizationSchema.partial()

export const createOrganizationRequestBodySchema = creatableOrganizationSchema
export const updateOrganizationRequestBodySchema = updatableOrganizationSchema
