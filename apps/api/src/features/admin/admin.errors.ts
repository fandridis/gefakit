import { ApiError } from "@gefakit/shared";

export const adminErrors = {
  authenticationRequired: (reason: string = 'Authentication required for admin action') => new ApiError(
    reason,
    401,
    { code: 'ADMIN_AUTH_REQUIRED' }
  ),

  cannotImpersonateSelf: () => new ApiError(
    'Cannot impersonate yourself',
    400, // Bad Request
    { code: 'ADMIN_CANNOT_IMPERSONATE_SELF' }
  ),

  impersonationSessionNotFound: () => new ApiError(
    'Session not found for impersonation action',
    401, // Unauthorized or Not Found could fit, but 401 seems reasonable for session issues
    { code: 'ADMIN_IMPERSONATION_SESSION_NOT_FOUND' }
  ),

  notImpersonating: () => new ApiError(
    'Not currently impersonating or session invalid for stopping impersonation',
    400, // Bad Request
    { code: 'ADMIN_NOT_IMPERSONATING' }
  ),

  // Add other admin-specific errors here as needed

} as const;
