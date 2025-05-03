import { ApiError } from "@gefakit/shared";

export const organizationErrors = {
  organizationNotFound: () => new ApiError('Organization not found', 404, { code: 'ORGANIZATION_NOT_FOUND' }),
  actionNotAllowed: () => new ApiError('Action not allowed', 403, { code: 'ACTION_NOT_ALLOWED' }),
} as const;