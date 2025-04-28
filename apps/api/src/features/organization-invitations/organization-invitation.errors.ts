/**
 * This file should be defined at src/errors/index.ts
 */

import { ApiError } from "@gefakit/shared";

export const organizationInvitationErrors = {
  invitationNotFound: () =>
    new ApiError('Organization invitation not found or expired', 404, { code: 'ORGANIZATION_INVITATION_NOT_FOUND' }),

  actionNotAllowed: (reason: string = 'Action not allowed') =>
    new ApiError('Action not allowed', 403, { code: 'ACTION_NOT_ALLOWED', reason }),

} as const;