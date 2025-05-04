import { ApiError } from "@gefakit/shared";

export const adminErrors = {
  // error when not allowed to impersonate
  notAllowedToImpersonate: (details: Record<string, any> = {}) => new ApiError('Not allowed to impersonate', 403, { code: 'NOT_ALLOWED_TO_IMPERSONATE', ...details }),
  authenticationRequired: () => new ApiError('Authentication required for admin action', 401, { code: 'ADMIN_AUTH_REQUIRED' }),
  cannotImpersonateSelf: () => new ApiError('Cannot impersonate yourself', 400, { code: 'ADMIN_CANNOT_IMPERSONATE_SELF' }),
  impersonationSessionNotFound: () => new ApiError('Session not found for impersonation action', 401, { code: 'ADMIN_IMPERSONATION_SESSION_NOT_FOUND' }),
  notImpersonating: () => new ApiError('Not currently impersonating or session invalid for stopping impersonation', 400, { code: 'ADMIN_NOT_IMPERSONATING' }),

  // Add other admin-specific errors here as needed

} as const;
