import { z } from 'zod'

export const membershipRoleSchema = z.enum(['owner', 'admin', 'member'])
export type MembershipRole = z.infer<typeof membershipRoleSchema>

export const membershipSchema = z.object({
  userId: z.number().int().positive(),
  organizationId: z.number().int().positive(),
  role: membershipRoleSchema,
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export type Membership = z.infer<typeof membershipSchema> 