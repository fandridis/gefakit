/**
 * This file should be defined at src/errors/index.ts
 */

import { ApiError } from "@gefakit/shared";

export const organizationInvitationErrors = {
  invitationNotFound: () => new ApiError('Organization invitation not found or expired', 404, { code: 'ORGANIZATION_INVITATION_NOT_FOUND' }),
  invitationExpired: () => new ApiError('Invitation expired', 403, { code: 'ORGANIZATION_INVITATION_EXPIRED' }),
  invitationAlreadyProcessed: () => new ApiError('Invitation already accepted/declined', 403, { code: 'ORGANIZATION_INVITATION_ALREADY_PROCESSED' })
} as const;