import { AppError } from "../../core/app-error";

export const adminErrors = {
  authenticationRequired: (reason: string = 'Authentication required for admin action') => new AppError(
    reason,
    401,
    { code: 'ADMIN_AUTH_REQUIRED' }
  ),

  cannotImpersonateSelf: () => new AppError(
    'Cannot impersonate yourself',
    400, // Bad Request
    { code: 'ADMIN_CANNOT_IMPERSONATE_SELF' }
  ),

  impersonationSessionNotFound: () => new AppError(
    'Session not found for impersonation action',
    401, // Unauthorized or Not Found could fit, but 401 seems reasonable for session issues
    { code: 'ADMIN_IMPERSONATION_SESSION_NOT_FOUND' }
  ),

  notImpersonating: () => new AppError(
    'Not currently impersonating or session invalid for stopping impersonation',
    400, // Bad Request
    { code: 'ADMIN_NOT_IMPERSONATING' }
  ),

  // Add other admin-specific errors here as needed

} as const;
