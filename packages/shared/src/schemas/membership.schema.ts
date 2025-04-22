import { z } from 'zod'

export const membershipRoleSchema = z.enum(['owner', 'admin', 'member'])
export type MembershipRole = z.infer<typeof membershipRoleSchema>

export const membershipSchema = z.object({
  user_id: z.number().int().positive(),
  organization_id: z.number().int().positive(),
  role: membershipRoleSchema,
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
})

export type Membership = z.infer<typeof membershipSchema> 