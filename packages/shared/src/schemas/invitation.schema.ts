import { z } from 'zod'
import { membershipRoleSchema } from './membership.schema'

export const invitationStatusSchema = z.enum([
  'pending',
  'accepted',
  'declined',
  'expired',
])
export type InvitationStatus = z.infer<typeof invitationStatusSchema>

export const invitationSchema = z.object({
  id: z.number().int().positive(),
  organization_id: z.number().int().positive(),
  invited_by_user_id: z.number().int().positive().nullable(), // Can be null if inviter user is deleted
  email: z.string().email(),
  role: membershipRoleSchema,
  token: z.string().min(1), // Assuming tokens are non-empty strings
  status: invitationStatusSchema,
  expires_at: z.coerce.date(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
})

export type Invitation = z.infer<typeof invitationSchema> 