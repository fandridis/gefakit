/**
 * This file should be defined at src/errors/index.ts
 */

import { AppError } from "../../core/app-error";

export const organizationMembershipErrors = {
  organizationMembershipNotFound: () =>
    new AppError('Organization membership not found', 404, { code: 'ORGANIZATION_MEMBERSHIP_NOT_FOUND' }),

  actionNotAllowed: (reason: string = 'Action not allowed') =>
    new AppError('Action not allowed', 403, { code: 'ACTION_NOT_ALLOWED', reason }),

} as const;