/**
 * This file should be defined at src/errors/index.ts
 */

import { ApiError } from "@gefakit/shared";

export const authErrors = {
  invalidCredentials: () => new ApiError(
    'Invalid credentials provided',
    401,
    { code: 'AUTH_INVALID_CREDENTIALS' }
  ),

  unauthorized: (reason: string = 'No session found') => new ApiError(
    reason,
    401,
    { code: 'AUTH_UNAUTHORIZED', reason }
  ),

  tokenExpired: () => new ApiError(
    'Session token has expired',
    401,
    { code: 'AUTH_TOKEN_EXPIRED' }
  ),

  weakPassword: (reason: string = 'Password is too weak') => new ApiError(
    reason,
    400,
    { code: 'AUTH_WEAK_PASSWORD', reason }
  ),

  userCreationFailed: (reason: string = 'Unable to create user account') => new ApiError(
    reason,
    500,
    { code: 'AUTH_USER_CREATION_FAILED', reason }
  ),

  userNotFound: () => new ApiError(
    'User not found',
    404,
    { code: 'AUTH_USER_NOT_FOUND' }
  ),

  emailVerificationTokenNotFound: () => new ApiError(
    'Email verification token not found',
    404,
    { code: 'AUTH_EMAIL_VERIFICATION_TOKEN_NOT_FOUND' }
  ),
  
  emailNotVerified: () => new ApiError(
    'Email not verified',
    401,
    { code: 'AUTH_EMAIL_NOT_VERIFIED' }
  ),

  oauthEmailRequired: ({ provider }: { provider: string }) => new ApiError(
    `An email address is required to sign up or link your ${provider} account. Please ensure your ${provider} account has a public email address or try another sign-in method.`,
    400,
    { code: 'AUTH_OAUTH_EMAIL_REQUIRED', provider }
  ),

  invalidOtp: () => new ApiError(
    'Invalid or expired OTP code provided',
    400, // Bad Request
    { code: 'AUTH_INVALID_OTP' }
  ),

  expiredOtp: () => new ApiError(
    'OTP code has expired',
    400, // Bad Request
    { code: 'AUTH_EXPIRED_OTP' }
  ),

  invalidPasswordResetToken: () => new ApiError(
    'Invalid password reset token',
    400, // Bad Request
    { code: 'AUTH_INVALID_PASSWORD_RESET_TOKEN' }
  ),
  expiredPasswordResetToken: () => new ApiError(
    'Password reset token has expired',
    400, // Bad Request
    { code: 'AUTH_EXPIRED_PASSWORD_RESET_TOKEN' }
  ),

  failedToResetPassword: () => new ApiError(
    'Failed to reset password due to a server error.',
    500,
    { code: 'AUTH_PASSWORD_RESET_FAILED' }
  ),

  invalidVerificationToken: () => new ApiError(
    'Invalid email verification token.',
    400,
    { code: 'AUTH_INVALID_VERIFICATION_TOKEN' }
  ),

  expiredVerificationToken: () => new ApiError(
    'Email verification token has expired.',
    400,
    { code: 'AUTH_EXPIRED_VERIFICATION_TOKEN' }
  ),

  failedToCompleteEmailVerification: () => new ApiError(
    'Failed to complete email verification due to a server error.',
    500,
    { code: 'AUTH_EMAIL_VERIFICATION_FAILED' }
  ),

  failedToRefetchUserAfterLinkingOAuthAccountByEmail: () => new ApiError(
    'Failed to retrieve user details after linking OAuth account.',
    500,
    { code: 'AUTH_OAUTH_LINK_REFETCH_FAILED' }
  ),

  failedToLinkOAuthAccountDuringTransaction: () => new ApiError(
    'Failed to link OAuth account during sign up.',
    500,
    { code: 'AUTH_OAUTH_LINK_TX_FAILED' }
  ),

  transactionFailedToReturnUserData: () => new ApiError(
    'User creation process failed unexpectedly.',
    500,
    { code: 'AUTH_SIGNUP_TX_NO_USER' }
  ),

  failedToCompleteSignUpProcess: () => new ApiError(
    'Failed to complete the sign-up process.',
    500,
    { code: 'AUTH_SIGNUP_FAILED' }
  ),

  failedToRetrieveUserDetailsAfterOAuthProcess: () => new ApiError(
    'Failed to retrieve user details after OAuth process.',
    500,
    { code: 'AUTH_OAUTH_POST_PROCESS_FAILED' }
  ),
  
} as const;