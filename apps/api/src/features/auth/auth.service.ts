import { encodeHexLowerCase } from "@oslojs/encoding";
import { Kysely, Transaction, Insertable, Selectable } from "kysely";
import { DB, AuthUser } from "../../db/db-types";
import { AuthRepository, createAuthRepository } from "./auth.repository";
import { sha256 } from "@oslojs/crypto/sha2";
import { encodeBase32LowerCaseNoPadding, encodeBase64url } from "@oslojs/encoding";
import { SessionDTO, UserDTO } from "@gefakit/shared";
import { ApiError } from "@gefakit/shared";
import { hashPassword, verifyPassword } from "../../lib/crypto";
import { OrganizationRepository, createOrganizationRepository } from "../organizations/organization.repository";
import { createUserWithOrganizationAndMembership, CreateUserWithOrgData } from "../users/user-creation.util";
import { randomUUID } from 'node:crypto';
import { authErrors } from "./auth.errors";

export type AuthService = ReturnType<typeof createAuthService>;

// Interface for normalized OAuth user data
export interface OAuthUserDetails {
    provider: 'github' | 'google';
    providerUserId: string;
    email: string | null;
    username: string;
}

export function createAuthService(
    {
        db,
        authRepository,
        createAuthRepository,
        createOrganizationRepository
    }:
        {
            db: Kysely<DB>,
            authRepository: AuthRepository,
            createAuthRepository: (args: { db: Kysely<DB> | Transaction<DB> }) => AuthRepository,
            createOrganizationRepository: (args: { db: Kysely<DB> | Transaction<DB> }) => OrganizationRepository
        }) {
    const SESSION_DURATION = 30 * 24 * 60 * 60 * 1000;
    const SESSION_RENEWAL_THRESHOLD = 15 * 24 * 60 * 60 * 1000;
    const PASSWORD_RESET_TOKEN_DURATION = 15 * 60 * 1000; // 15 minutes
    const OTP_CODE_DURATION = 5 * 60 * 1000; // 5 minutes
    const OTP_LENGTH = 6; // 6-digit OTP
    const EMAIL_VERIFICATION_TOKEN_DURATION = 24 * 60 * 60 * 1000; // 24 hours

    /**
     * Find user by id
     */
    async function findUserById({ id }: { id: number }) {
        return await authRepository.findUserById(id);
    }

    async function findSessionById({ id }: { id: string }) {
        return await authRepository.findSessionWithUser({ sessionId: id });
    }

    /**
     * Generates a cryptographically secure random session token.
     * 
     * @returns A base32 encoded string representing the session token.
     */
    function generateSessionToken(): string {
        const bytes = new Uint8Array(20);
        crypto.getRandomValues(bytes);
        return encodeBase32LowerCaseNoPadding(bytes);
    }

    /**
     * Generates a session ID by hashing the provided token.
     * 
     * @param token - The session token to hash.
     * @returns A hex-encoded string representing the session ID.
     */
    function generateSessionId({ token }: { token: string }) {
        return encodeHexLowerCase(sha256(new TextEncoder().encode(token)));
    }

    /**
     * Generates a cryptographically secure random password reset token.
     * 
     * @returns A base64url encoded string representing the token.
     */
    function generatePasswordResetToken(): string {
        const bytes = new Uint8Array(32); // Use more bytes for higher entropy
        crypto.getRandomValues(bytes);
        return encodeBase64url(bytes); // Use base64url for URL safety
    }

    /**
     * Hashes a password reset token.
     * 
     * @param token - The plaintext password reset token.
     * @returns A hex-encoded string representing the hashed token.
     */
    function hashPasswordResetToken({ token }: { token: string }): string {
        // Use SHA-256 for consistency with session IDs, but other secure hash functions are also viable
        return encodeHexLowerCase(sha256(new TextEncoder().encode(token)));
    }

    /**
     * Generates a random OTP code of a specified length.
     *
     * @returns A numeric string representing the OTP code.
     */
    function generateOtpCode(): string {
        if (typeof crypto === 'undefined' || !crypto.getRandomValues) {
            throw new Error('Web Crypto API not available');
        }
        // Generate secure random numbers for OTP
        const randomValues = new Uint32Array(OTP_LENGTH);
        crypto.getRandomValues(randomValues);

        let otp = '';
        for (let i = 0; i < OTP_LENGTH; i++) {
            otp += (randomValues[i] % 10).toString(); // Get a single digit (0-9)
        }
        return otp;
    }

    /**
     * Hashes an OTP code.
     *
     * @param code - The plaintext OTP code.
     * @returns A hex-encoded string representing the hashed code.
     */
    function hashOtpCode({ code }: { code: string }): string {
        // Use SHA-256 for hashing, consistent with other tokens
        return encodeHexLowerCase(sha256(new TextEncoder().encode(code)));
    }

    /**
     * Hashes an email verification token.
     * 
     * @param token - The plaintext email verification token.
     * @returns A hex-encoded string representing the hashed token.
     */
    function hashEmailVerificationToken({ token }: { token: string }): string {
        return encodeHexLowerCase(sha256(new TextEncoder().encode(token)));
    }

    /**
     * Creates a new session for the specified user.
     * 
     * @param userId - The ID of the user to create a session for.
     * @returns A Promise that resolves to an object containing the session and token.
     */
    async function createSession({ userId }: { userId: number }) {
        const token = generateSessionToken();
        const sessionId = generateSessionId({ token });

        const session = await authRepository.createSession({
            session: {
                id: sessionId,
                user_id: userId,
                expires_at: new Date(Date.now() + SESSION_DURATION)
            }
        })

        if (!session) {
            throw new Error('Failed to create session');
        }

        return {
            session: {
                id: session.id,
                user_id: session.user_id,
                expires_at: session.expires_at,
            },
            token
        };
    }

    /**
     * Validates a session token and retrieves the associated session and user.
     * 
     * @param token - The session token to validate.
     * @returns A Promise that resolves to an object containing the session and user, or null values if invalid.
     */
    async function validateSession({ token }: { token: string }) {
        const sessionId = generateSessionId({ token });
        const result = await authRepository.findSessionWithUser({ sessionId });

        if (!result) {
            return { session: null, user: null };
        }

        const session: SessionDTO = {
            id: result.id,
            user_id: result.user_id,
            expires_at: result.expires_at,
            impersonator_user_id: result.impersonator_user_id,
            role: result.role
        };

        // Handle expired session
        if (Date.now() >= session.expires_at.getTime()) {
            await authRepository.deleteSession({ sessionId });
            return { session: null, user: null };
        }

        let newToken: string | null = null;

        if (Date.now() >= session.expires_at.getTime() - SESSION_RENEWAL_THRESHOLD) {
            newToken = generateSessionToken();
            const newSessionId = generateSessionId({ token: newToken });
            const newExpiryDate = new Date(Date.now() + SESSION_DURATION);

            await authRepository.updateSessionIdAndExpiry({
                oldSessionId: session.id,
                newSessionId: newSessionId,
                expiresAt: newExpiryDate
            });

            // Update the session object in memory for the response
            session.id = newSessionId;
            session.expires_at = newExpiryDate;
        }

        const user: UserDTO = {
            id: result.user_id,
            email: result.email,
            username: result.username,
            created_at: result.created_at,
            email_verified: result.email_verified,
            role: result.role,
            stripe_customer_id: result.stripe_customer_id
        };

        return { session, user, newToken };
    }

    /**
     * Authenticates a user with email and password, creating a new session if successful.
     * 
     * @param email - The user's email address.
     * @param password - The user's password.
     * @returns A Promise that resolves to an object containing the user and session token.
     */
    async function signInWithEmail({ email, password }: { email: string; password: string }) {
        const user = await authRepository.findUserWithPasswordByEmail({ email });
        if (!user) {
            throw authErrors.invalidCredentials();
        }

        if (!user.email_verified) {
            throw authErrors.emailNotVerified();
        }

        const isValidPassword = await verifyPassword(password, user.password_hash);
        if (!isValidPassword) {
            throw authErrors.invalidCredentials();
        }

        const { token } = await createSession({ userId: user.id });

        const { password_hash, ...userWithoutPassword } = user;
        return {
            user: userWithoutPassword,
            sessionToken: token
        };
    }

    /**
     * Retrieves the current session and associated user for a given session token.
     * 
     * @param token - The session token to validate.
     * @returns A Promise that resolves to an object containing the session and user.
     */
    async function getCurrentSession({ token }: { token: string }) {
        return await validateSession({ token });
    }

    /**
     * Invalidates a session by deleting it from the database.
     * 
     * @param token - The session token to invalidate.
     * @returns A Promise that resolves when the session has been invalidated.
     */
    async function invalidateSession({ token }: { token: string }) {
        const sessionId = generateSessionId({ token });
        await authRepository.deleteSession({ sessionId });
    }

    /**
     * Invalidates all sessions for a specific user.
     * 
     * @param userId - The ID of the user whose sessions should be invalidated.
     * @returns A Promise that resolves when all sessions have been invalidated.
     */
    async function invalidateAllSessions({ userId }: { userId: number }) {
        await authRepository.deleteAllUserSessions({ userId });
    }

    /**
     * Generates a password reset token for a user and stores its hash.
     *
     * @param email The user's email address.
     * @returns The plaintext token to be sent to the user, or null if the user is not found.
     */
    async function requestPasswordReset({ email }: { email: string }): Promise<string | null> {
        const user = await authRepository.findUserWithPasswordByEmail({ email });
        if (!user) {
            console.warn(`Password reset requested for non-existent email: ${email}`);
            // Return null, but don't throw an error to avoid email enumeration
            return null;
        }

        // Invalidate any existing reset tokens for this user first
        await authRepository.deletePasswordResetTokensByUserId({ userId: user.id });

        const plainToken = generatePasswordResetToken();
        const hashedToken = hashPasswordResetToken({ token: plainToken });
        const expiresAt = new Date(Date.now() + PASSWORD_RESET_TOKEN_DURATION);

        await authRepository.createPasswordResetToken({
            user_id: user.id,
            hashed_token: hashedToken,
            expires_at: expiresAt
        });

        return plainToken;
    }

    /**
     * Resets a user's password using a valid reset token.
     *
     * @param token The plaintext password reset token received from the user.
     * @param newPassword The new password provided by the user.
     * @throws ApiError if the token is invalid, expired, or the password update fails.
     */
    async function resetPassword({ token, newPassword }: { token: string, newPassword: string }): Promise<void> {
        const hashedToken = hashPasswordResetToken({ token });
        const resetRecord = await authRepository.findPasswordResetTokenByHashedToken({ hashedToken });

        if (!resetRecord) {
            throw authErrors.invalidPasswordResetToken();
        }

        if (new Date() > resetRecord.expires_at) {
            // Clean up expired token
            await authRepository.deletePasswordResetToken({ tokenId: resetRecord.id });
            throw authErrors.expiredPasswordResetToken();
        }

        // Token is valid, proceed with password update
        const newPasswordHash = await hashPassword(newPassword);

        try {
            await db.transaction().execute(async (trx) => {
                const txAuthRepo = createAuthRepository({ db: trx });

                // Update password
                await txAuthRepo.updateUserPassword({
                    userId: resetRecord.user_id,
                    passwordHash: newPasswordHash
                });

                // Also mark the email as verified
                await txAuthRepo.updateUserEmailVerified({
                    userId: resetRecord.user_id,
                    verified: true
                });

                // Delete the used reset token
                await txAuthRepo.deletePasswordResetToken({ tokenId: resetRecord.id });

                // Optional: Invalidate all active sessions for the user for extra security
                await txAuthRepo.deleteAllUserSessions({ userId: resetRecord.user_id });
            });
        } catch (error) {
            console.error(`Failed to reset password for user ${resetRecord.user_id} in transaction:`, error);
            throw authErrors.failedToResetPassword();
        }
    }

    /**
     * Verifies a user's email using a verification token.
     * 
     * @param token - The verification token.
     * @returns A Promise that resolves when the email is successfully verified.
     * @throws ApiError if the token is invalid, expired, or if the update fails.
     */
    async function verifyEmail({ token }: { token: string }) {
        // Hash the incoming token before searching
        console.log('Trying to verify email with token:', token);
        const hashedToken = hashEmailVerificationToken({ token });
        // Use the service-level authRepository for the initial find (outside transaction)
        const verificationRecord = await authRepository.findEmailVerificationTokenByValue({ tokenValue: hashedToken });

        console.log('verificationRecord:', verificationRecord);
        if (!verificationRecord) {
            throw authErrors.invalidVerificationToken();
        }

        const now = new Date();
        if (now > verificationRecord.expires_at) {
            throw authErrors.expiredVerificationToken();
        }

        try {
            // Start transaction
            await db.transaction().execute(async (trx: Transaction<DB>) => {
                // Create repository bound to the transaction
                const txAuthRepo = createAuthRepository({ db: trx });

                // Use transaction-bound repository (no trx argument needed)
                await txAuthRepo.updateUserEmailVerified({
                    userId: verificationRecord.user_id,
                    verified: true
                });

                // Use transaction-bound repository (no trx argument needed)
                await txAuthRepo.deleteEmailVerificationToken({
                    tokenId: verificationRecord.id
                });
            });
        } catch (err) {
            console.error('Failed to verify email in transaction:', err);
            throw authErrors.failedToCompleteEmailVerification();
        }
    }

    /**
     * Handles the OAuth callback, finds or creates a user, links the OAuth account,
     * and create a session.
     * 
     * @param oauthDetails - Normalized user details from the OAuth provider.
     * @returns A Promise resolving to the user DTO and session token.
     */
    async function handleOAuthCallback(oauthDetails: OAuthUserDetails) {
        let user = await authRepository.findUserByProviderId({
            provider: oauthDetails.provider,
            providerUserId: oauthDetails.providerUserId
        });

        let userId: number;

        if (user) {
            userId = user.id;
        } else {
            // No existing OAuth link found
            if (oauthDetails.email) {
                // Note: We trust the email from Google/GitHub IF they mark it as verified.
                // You might want stricter checks depending on your security model.
                const existingUserByEmail = await authRepository.findUserWithPasswordByEmail({ email: oauthDetails.email });

                if (existingUserByEmail) {
                    userId = existingUserByEmail.id;

                    await authRepository.linkOAuthAccount({
                        account: {
                            user_id: userId,
                            provider: oauthDetails.provider,
                            provider_user_id: oauthDetails.providerUserId
                        }
                    });
                    // Re-fetch user data to ensure consistency (excluding password)
                    const refetchedUser = await authRepository.findUserById(userId);
                    if (!refetchedUser) {
                        // This really shouldn't happen if linking succeeded and user existed
                        throw authErrors.failedToRefetchUserAfterLinkingOAuthAccountByEmail();
                    }
                    user = refetchedUser;
                } else {
                    // User not found by email either, create a new user, org, membership and link OAuth in a transaction             
                    try {
                        const createdUserData = await db.transaction().execute(async (trx: Transaction<DB>) => {
                            const authRepoTx = createAuthRepository({ db: trx });
                            const orgRepoTx = createOrganizationRepository({ db: trx });

                            if (!oauthDetails.email) {
                                throw authErrors.oauthEmailRequired({ provider: oauthDetails.provider });
                            }

                            const { user: createdUser, orgId } = await createUserWithOrganizationAndMembership(
                                trx,
                                createAuthRepository,
                                createOrganizationRepository,
                                {
                                    email: oauthDetails.email,
                                    username: oauthDetails.username,
                                    password_hash: 'oauth_no_password', // Specific for OAuth
                                    email_verified: true, // Verified via OAuth provider
                                    role: 'USER', // Default role

                                }
                            );
                            const createdUserId = createdUser.id;

                            // Link the new OAuth account (This step remains separate)
                            const linkedAccount = await authRepoTx.linkOAuthAccount({
                                account: {
                                    user_id: createdUserId,
                                    provider: oauthDetails.provider,
                                    provider_user_id: oauthDetails.providerUserId
                                }
                            });
                            if (!linkedAccount) { // Check linking
                                throw authErrors.failedToLinkOAuthAccountDuringTransaction();
                            }

                            // The utility function already returns the created user object
                            return createdUser;
                        });

                        // Assign the user data returned from the successful transaction
                        if (!createdUserData) {
                            // This should ideally be caught by errors within the transaction,
                            // but this check handles potential edge cases and satisfies the type checker.
                            throw authErrors.transactionFailedToReturnUserData();
                        }
                        user = createdUserData;
                        userId = user.id; // Assign userId after confirming user is not null

                    } catch (error) {
                        console.error("OAuth user creation transaction failed:", error);
                        // Propagate a more generic error or handle specific cases
                        if (error instanceof ApiError) throw error;
                        throw authErrors.failedToCompleteSignUpProcess();
                    }
                }
            } else {
                // OAuth provider didn't give us an email (e.g., private GitHub email)
                // We cannot reliably find an existing user or create a new one without an email.
                // You might need to prompt the user for an email on the frontend 
                // or handle this case differently based on your requirements.
                throw authErrors.oauthEmailRequired({ provider: oauthDetails.provider });
            }
        }

        // By this point, we should have a valid user object (either found or created)
        if (!user) {
            // This check narrows user type to AuthUser below
            throw authErrors.failedToRetrieveUserDetailsAfterOAuthProcess();
        }

        const { token } = await createSession({ userId: user.id });

        return {
            user: user,
            sessionToken: token
        };
    }

    // --- OTP Sign In --- 

    /**
     * Generates an OTP for a user and stores its hash.
     * Requires the user to exist and have a verified email.
     *
     * @param email The user's email address.
     * @returns The plaintext OTP to be sent to the user, or null if user not found or email not verified.
     * @throws ApiError if email is not verified.
     */
    async function requestOtpSignIn({ email }: { email: string }): Promise<string | null> {
        const user = await authRepository.findUserWithPasswordByEmail({ email });
        if (!user) {
            console.warn(`OTP sign-in requested for non-existent email: ${email}`);
            // Return null to avoid email enumeration
            return null;
        }

        if (!user.email_verified) {
            // Unlike password reset, OTP sign-in should require a verified email
            console.warn(`OTP sign-in requested for unverified email: ${email}`);
            throw authErrors.emailNotVerified();
        }

        // Invalidate any existing OTP codes for this user first
        await authRepository.deleteOtpCodesByUserId({ userId: user.id });

        const plainOtp = generateOtpCode();
        const hashedCode = hashOtpCode({ code: plainOtp });
        const expiresAt = new Date(Date.now() + OTP_CODE_DURATION);

        await authRepository.createOtpCode({
            user_id: user.id,
            hashed_code: hashedCode,
            expires_at: expiresAt
        });

        return plainOtp;
    }

    /**
     * Verifies an OTP code and signs the user in by creating a session.
     *
     * @param email The user's email address.
     * @param otp The plaintext OTP code provided by the user.
     * @returns A Promise resolving to the user object and session token.
     * @throws ApiError if the user is not found, OTP is invalid/expired, or session creation fails.
     */
    async function verifyOtpAndSignIn({ email, otp }: { email: string; otp: string }) {
        const user = await authRepository.findUserWithPasswordByEmail({ email });
        if (!user) {
            console.warn(`OTP verification attempt for non-existent email: ${email}`);
            throw authErrors.invalidOtp(); // Generic error
        }

        const otpRecord = await authRepository.findActiveOtpCodeByUserId({ userId: user.id });

        if (!otpRecord) {
            console.warn(`OTP verification attempt with no active code for user: ${user.id}`);
            throw authErrors.invalidOtp(); // Generic error (no active code)
        }

        // Note: findActiveOtpCodeByUserId already checks expiry in the query,
        // but a double check here is harmless and protects against race conditions.
        if (new Date() > otpRecord.expires_at) {
            console.warn(`OTP verification attempt with expired code for user: ${user.id}`);
            // Clean up expired code
            await authRepository.deleteOtpCodeById({ id: otpRecord.id });
            throw authErrors.expiredOtp();
        }

        const hashedInputOtp = hashOtpCode({ code: otp });

        if (hashedInputOtp !== otpRecord.hashed_code) {
            console.warn(`OTP verification attempt with incorrect code for user: ${user.id}`);
            // Consider adding rate limiting or lockout logic here for repeated failures
            throw authErrors.invalidOtp();
        }

        // OTP is valid, delete it and create a session
        await authRepository.deleteOtpCodeById({ id: otpRecord.id });

        const { token } = await createSession({ userId: user.id });

        const { password_hash, ...userWithoutPassword } = user;
        return {
            user: userWithoutPassword,
            sessionToken: token
        };
    }

    /**
     * Handles request to resend email verification token
     *
     * @param email
     * @returns A Promise that resolves to the user and plain verification token, or null.
     */
    async function resendVerificationEmail({ email }: { email: string }): Promise<{ user: Selectable<AuthUser>, verificationToken: string } | null> {
        // Fetch the user including password hash to match the AuthUser type
        const user = await authRepository.findUserWithPasswordByEmail({ email });

        if (!user) {
            // User not found, return null to avoid enumeration
            return null;
        }

        if (user.email_verified) {
            // Email already verified, nothing to do
            return null;
        }

        const plainToken = randomUUID(); // Use randomUUID
        const tokenHash = hashEmailVerificationToken({ token: plainToken }); // Hash the token
        const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_TOKEN_DURATION);

        try {
            await db.transaction().execute(async (tx) => {
                const repo = createAuthRepository({ db: tx });

                // Delete any existing verification tokens for this user
                await repo.deleteEmailVerificationTokensByUserId({ userId: user.id });

                // Insert the new verification token using the HASHED value
                await repo.createEmailVerificationToken({
                    user_id: user.id,
                    value: tokenHash, // Store the hash
                    identifier: user.email, // Use email as identifier
                    expires_at: expiresAt
                });
            });

            // Return full user object (as required by AuthUser type) and the PLAIN token
            return { user, verificationToken: plainToken };

        } catch (error) {
            console.error("Failed to resend verification email transaction:", error);
            // Depending on error handling strategy, you might want to throw a specific internal error
            // For now, return null as the operation failed
            return null;
        }
    }

    return {
        findUserById,
        findSessionById,
        signInWithEmail,
        validateSession,
        getCurrentSession,
        invalidateSession,
        invalidateAllSessions,
        generateSessionToken,
        generateSessionId,
        createSession,
        hashPassword,
        verifyPassword,
        verifyEmail,
        handleOAuthCallback,
        requestPasswordReset,
        resetPassword,
        requestOtpSignIn,
        verifyOtpAndSignIn,
        resendVerificationEmail,
    };
}