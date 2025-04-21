/**
 * This file should be defined at src/errors/index.ts
 */

import { AppError } from "../../errors/app-error";

export const organizationInvitationErrors = {
  invitationNotFound: () =>
    new AppError('Organization invitation not found or expired', 404, { code: 'ORGANIZATION_INVITATION_NOT_FOUND' }),

  actionNotAllowed: (reason: string = 'Action not allowed') =>
    new AppError('Action not allowed', 403, { code: 'ACTION_NOT_ALLOWED', reason }),

} as const;