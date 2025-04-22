/**
 * This file should be defined at src/errors/index.ts
 */

import { AppError } from "../../errors/app-error";

export const authErrors = {
  invalidCredentials: () => new AppError(
    'Invalid credentials provided',
    401,
    { code: 'AUTH_INVALID_CREDENTIALS' }
  ),

  unauthorized: (reason: string = 'No session found') => new AppError(
    reason,
    401,
    { code: 'AUTH_UNAUTHORIZED', reason }
  ),

  tokenExpired: () => new AppError(
    'Session token has expired',
    401,
    { code: 'AUTH_TOKEN_EXPIRED' }
  ),

  weakPassword: (reason: string = 'Password is too weak') => new AppError(
    reason,
    400,
    { code: 'AUTH_WEAK_PASSWORD', reason }
  ),

  userCreationFailed: (reason: string = 'Unable to create user account') => new AppError(
    reason,
    500,
    { code: 'AUTH_USER_CREATION_FAILED', reason }
  ),

  userNotFound: () => new AppError(
    'User not found',
    404,
    { code: 'AUTH_USER_NOT_FOUND' }
  ),

  emailVerificationTokenNotFound: () => new AppError(
    'Email verification token not found',
    404,
    { code: 'AUTH_EMAIL_VERIFICATION_TOKEN_NOT_FOUND' }
  ),
  
  emailNotVerified: () => new AppError(
    'Email not verified',
    401,
    { code: 'AUTH_EMAIL_NOT_VERIFIED' }
  ),

  oauthEmailRequired: ({ provider }: { provider: string }) => new AppError(
    `An email address is required to sign up or link your ${provider} account. Please ensure your ${provider} account has a public email address or try another sign-in method.`,
    400,
    { code: 'AUTH_OAUTH_EMAIL_REQUIRED', provider }
  ),
} as const;