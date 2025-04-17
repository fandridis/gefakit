import { encodeHexLowerCase } from "@oslojs/encoding";
import { Kysely, Transaction } from "kysely";
import { DB } from "../../db/db-types";
import { createAuthRepository } from "./auth.repository";
import { sha256 } from "@oslojs/crypto/sha2";
import { encodeBase32LowerCaseNoPadding } from "@oslojs/encoding";
import { SessionDTO, UserDTO } from "@gefakit/shared";
import { createAppError } from "../../errors";
import { createOrganizationRepository } from "../organizations/organizations.repository";
import { hashPassword, verifyPassword } from "../../lib/crypto";

export function createAuthService(db: Kysely<DB>) {
    const repository = createAuthRepository(db);
    const orgRepository = createOrganizationRepository(db);
    const SESSION_DURATION = 30 * 24 * 60 * 60 * 1000;
    const SESSION_RENEWAL_THRESHOLD = 15 * 24 * 60 * 60 * 1000;

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
        
        const session = await repository.createSession({
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
        const result = await repository.findSessionWithUser({ sessionId });

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
            await repository.deleteSession({ sessionId });
            return { session: null, user: null };
        }

        // Extend session if approaching expiration
        if (Date.now() >= session.expires_at.getTime() - SESSION_RENEWAL_THRESHOLD) {
            const newExpiryDate = new Date(Date.now() + SESSION_DURATION);
            await repository.updateSessionExpiry({ 
                sessionId: session.id, 
                expiresAt: newExpiryDate 
            });
            session.expires_at = newExpiryDate;
        }

        const user: UserDTO = {
            id: result.user_id,
            email: result.email,
            username: result.username,
            created_at: result.created_at
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
        const user = await repository.findUserWithPasswordByEmail({ email: data.email });
        if (!user) {
            throw createAppError.auth.invalidCredentials();
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
        await repository.deleteSession({ sessionId });
    }

    /**
     * Invalidates all sessions for a specific user.
     * 
     * @param userId - The ID of the user whose sessions should be invalidated.
     * @returns A Promise that resolves when all sessions have been invalidated.
     */
    async function invalidateAllSessions(userId: number): Promise<void> {
        await repository.deleteAllUserSessions({ userId });
    }

    return {
        signInWithEmail,
        validateSession,
        getCurrentSession,
        invalidateSession,
        invalidateAllSessions,
        generateSessionToken,
        generateSessionId,
        createSession,
        hashPassword,
        verifyPassword
    };
}