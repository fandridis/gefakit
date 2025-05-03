/**
 * This file should be defined at src/errors/index.ts
 */

import { ApiError } from "@gefakit/shared";

export const organizationMembershipErrors = {
  organizationMembershipNotFound: () => new ApiError('Organization membership not found', 404, { code: 'ORGANIZATION_MEMBERSHIP_NOT_FOUND' }),
  ownerCannotLeaveOrganization: () => new ApiError('You cannot leave the organization as the owner', 403, { code: 'OWNER_CANNOT_LEAVE_ORGANIZATION' }),
  onlyAdminsCanRemoveUsers: () => new ApiError('Only admins or owners can remove users from the organization', 403, { code: 'ONLY_ADMINS_CAN_REMOVE_USERS' }),
  cannotLeaveOnlyOrganization: () => new ApiError('You cannot leave your only organization', 403, { code: 'CANNOT_LEAVE_ONLY_ORGANIZATION' }),
} as const;