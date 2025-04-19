import { encodeHexLowerCase } from "@oslojs/encoding";
import { Kysely, Transaction } from "kysely";
import { DB } from "../../db/db-types";
import { AuthRepository, createAuthRepository } from "./auth.repository";
import { sha256 } from "@oslojs/crypto/sha2";
import { encodeBase32LowerCaseNoPadding } from "@oslojs/encoding";
import { SessionDTO, UserDTO } from "@gefakit/shared";
import { createAppError } from "../../errors";
import { AppError } from "../../errors/app-error";
import { hashPassword, verifyPassword } from "../../lib/crypto";

export type AuthService = ReturnType<typeof createAuthService>;

export function createAuthService({ db, authRepository }: { db: Kysely<DB>, authRepository: AuthRepository }) {
    const SESSION_DURATION = 30 * 24 * 60 * 60 * 1000;
    const SESSION_RENEWAL_THRESHOLD = 15 * 24 * 60 * 60 * 1000;

    /**
     * Find user by id
     */
    async function findUserById(id: number) {
        return await authRepository.findUserById(id);
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
    function generateSessionId(token: string): string {
        return encodeHexLowerCase(sha256(new TextEncoder().encode(token)));
    }

    /**
     * Creates a new session for the specified user.
     * 
     * @param userId - The ID of the user to create a session for.
     * @returns A Promise that resolves to an object containing the session and token.
     */
    async function createSession(userId: number): Promise<{ session: SessionDTO; token: string }> {
        const token = generateSessionToken();
        const sessionId = generateSessionId(token);
        
        const session = await authRepository.createSession({
            id: sessionId,
            user_id: userId,
            expires_at: new Date(Date.now() + SESSION_DURATION)
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
    async function validateSession(token: string) {
        const sessionId = generateSessionId(token);
        const result = await authRepository.findSessionWithUser({ sessionId });

        console.log('validating session: ', {sessionId, result})

        if (!result) {
            return { session: null, user: null };
        }

        const session: SessionDTO = {
            id: result.id,
            user_id: result.user_id,
            expires_at: result.expires_at
        };

        // Handle expired session
        if (Date.now() >= session.expires_at.getTime()) {
            await authRepository.deleteSession({ sessionId });
            return { session: null, user: null };
        }

        // Extend session if approaching expiration
        if (Date.now() >= session.expires_at.getTime() - SESSION_RENEWAL_THRESHOLD) {
            const newExpiryDate = new Date(Date.now() + SESSION_DURATION);
            await authRepository.updateSessionExpiry({ 
                sessionId: session.id, 
                expiresAt: newExpiryDate 
            });
            session.expires_at = newExpiryDate;
        }

        const user: UserDTO = {
            id: result.user_id,
            email: result.email,
            username: result.username,
            created_at: result.created_at,
            email_verified: result.email_verified
        };

        return { session, user };
    }

    /**
     * Authenticates a user with email and password, creating a new session if successful.
     * 
     * @param email - The user's email address.
     * @param password - The user's password.
     * @returns A Promise that resolves to an object containing the user and session token.
     */
    async function signInWithEmail(data: { email: string; password: string }) {
        const user = await authRepository.findUserWithPasswordByEmail({ email: data.email });
        if (!user) {
            throw createAppError.auth.invalidCredentials();
        }

        if (!user.email_verified) {
            throw createAppError.auth.emailNotVerified();
        }

        const isValidPassword = await verifyPassword(data.password, user.password_hash);
        if (!isValidPassword) {
            throw createAppError.auth.invalidCredentials();
        }

        const { token } = await createSession(user.id);

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
    async function getCurrentSession(token: string): Promise<{ session: any; user: any }> {
        return await validateSession(token);
    }

    /**
     * Invalidates a session by deleting it from the database.
     * 
     * @param token - The session token to invalidate.
     * @returns A Promise that resolves when the session has been invalidated.
     */
    async function invalidateSession(token: string): Promise<void> {
        const sessionId = generateSessionId(token);
        console.log('invalidating sessionId: ', {sessionId})
        await authRepository.deleteSession({ sessionId });
    }

    /**
     * Invalidates all sessions for a specific user.
     * 
     * @param userId - The ID of the user whose sessions should be invalidated.
     * @returns A Promise that resolves when all sessions have been invalidated.
     */
    async function invalidateAllSessions(userId: number): Promise<void> {
        await authRepository.deleteAllUserSessions({ userId });
    }

    /**
     * Verifies a user's email using a verification token.
     * 
     * @param token - The verification token.
     * @returns A Promise that resolves when the email is successfully verified.
     * @throws AppError if the token is invalid, expired, or if the update fails.
     */
    async function verifyEmail(token: string): Promise<void> {
        // Use the service-level authRepository for the initial find (outside transaction)
        const verificationRecord = await authRepository.findEmailVerificationTokenByValue({ tokenValue: token });

        console.log('verificationRecord: ', verificationRecord)

        if (!verificationRecord) {
            throw new AppError('Invalid or expired verification token.', 400);
        }

        const now = new Date();
        if (now > verificationRecord.expires_at) {
            throw new AppError('Verification token has expired.', 400);
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
            console.log(`Email verified for user ${verificationRecord.user_id}`);
        } catch (err) {
            console.error('Failed to verify email in transaction:', err);
            throw new AppError('Failed to complete email verification process.', 500);
        }
    }

    return {
        findUserById,
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
        verifyEmail
    };
}