/**
 * This file should be defined at src/errors/index.ts
 */

import { AppError } from "../../errors/app-error";

export const authErrors = {
  invalidCredentials: () =>
    new AppError('Invalid credentials provided', 401, { code: 'AUTH_INVALID_CREDENTIALS' }),

  unauthorized: (reason: string = 'No session found') =>
    new AppError('Unauthorized access', 401, { code: 'AUTH_UNAUTHORIZED', reason }),

  tokenExpired: () =>
    new AppError('Session token has expired', 401, { code: 'AUTH_TOKEN_EXPIRED' }),

  weakPassword: (reason: string) =>
    new AppError(`Password is too weak: ${reason}`, 400, { code: 'AUTH_WEAK_PASSWORD', reason }),

  userCreationFailed: (details?: Record<string, any>) =>
    new AppError('Failed to create user account', 500, { code: 'AUTH_USER_CREATION_FAILED', ...details }),

  userNotFound: () =>
    new AppError('User not found', 404, { code: 'AUTH_USER_NOT_FOUND' }),

  emailVerificationTokenNotFound: () =>
    new AppError('Email verification token not found', 404, { code: 'AUTH_EMAIL_VERIFICATION_TOKEN_NOT_FOUND' }),

  emailNotVerified: () =>
    new AppError('Email not verified', 401, { code: 'AUTH_EMAIL_NOT_VERIFIED' }),

} as const;