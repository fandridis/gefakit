import { encodeHexLowerCase } from "@oslojs/encoding";
import { Kysely, Transaction, Insertable, Selectable } from "kysely";
import { DB, AuthUser } from "../../db/db-types";
import { AuthRepository, createAuthRepository } from "./auth.repository";
import { sha256 } from "@oslojs/crypto/sha2";
import { encodeBase32LowerCaseNoPadding } from "@oslojs/encoding";
import { SessionDTO, UserDTO } from "@gefakit/shared";
import { createAppError } from "../../errors";
import { AppError } from "../../errors/app-error";
import { hashPassword, verifyPassword } from "../../lib/crypto";
import { OrganizationRepository } from "../organizations/organization.repository";

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

        console.log('validating session: ', {sessionId, result})

        if (!result) {
            return { session: null, user: null };
        }

        const session: SessionDTO = {
            id: result.id,
            user_id: result.user_id,
            expires_at: result.expires_at,
            impersonator_user_id: null
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
            email_verified: result.email_verified,
            role: result.role
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
    async function signInWithEmail({ email, password }: { email: string; password: string }) {
        const user = await authRepository.findUserWithPasswordByEmail({ email });
        if (!user) {
            throw createAppError.auth.invalidCredentials();
        }

        if (!user.email_verified) {
            throw createAppError.auth.emailNotVerified();
        }

        const isValidPassword = await verifyPassword(password, user.password_hash);
        if (!isValidPassword) {
            throw createAppError.auth.invalidCredentials();
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
        console.log('invalidating sessionId: ', {sessionId})
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
     * Verifies a user's email using a verification token.
     * 
     * @param token - The verification token.
     * @returns A Promise that resolves when the email is successfully verified.
     * @throws AppError if the token is invalid, expired, or if the update fails.
     */
    async function verifyEmail({ token }: { token: string }) {
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
            // User found via OAuth link, id should be a number
            userId = user.id; // Assuming user.id is number here
            console.log(`OAuth Login: Found existing user ${userId} via ${oauthDetails.provider} account ${oauthDetails.providerUserId}`);
        } else {
            // No existing OAuth link found
            // Try finding user by email (if provided by OAuth and verified)
            if (oauthDetails.email) {
                // Note: We trust the email from Google/GitHub IF they mark it as verified.
                // You might want stricter checks depending on your security model.
                // findUserWithPasswordByEmail likely returns AuthUser | undefined
                const existingUserByEmail = await authRepository.findUserWithPasswordByEmail({ email: oauthDetails.email });
                
                if (existingUserByEmail) {
                    console.log(`OAuth Login: Found existing user ${existingUserByEmail.id} by email ${oauthDetails.email} from ${oauthDetails.provider}. Linking account.`);
                    userId = existingUserByEmail.id;

                    await authRepository.linkOAuthAccount({ 
                        account: { 
                            user_id: userId,
                            provider: oauthDetails.provider,
                            provider_user_id: oauthDetails.providerUserId
                        }
                    });
                    // Re-fetch user data to ensure consistency (excluding password)
                    // findUserById likely returns AuthUser | undefined
                    const refetchedUser = await authRepository.findUserById(userId);
                    if (!refetchedUser) { // Added check
                        // This really shouldn't happen if linking succeeded and user existed
                        throw new AppError("Failed to refetch user after linking OAuth account by email.", 500); 
                    }
                    user = refetchedUser; // Assign refetched user data
                } else {
                    // User not found by email either, create a new user, org, membership and link OAuth in a transaction
                    console.log(`OAuth Login: Creating new user, org, membership for ${oauthDetails.email || oauthDetails.username} from ${oauthDetails.provider}`);
                    
                    // Explicit check to ensure email is non-null for type safety within transaction
                    if (!oauthDetails.email) {
                        // This should theoretically be caught by the outer check, but belts and suspenders
                        throw createAppError.auth.oauthEmailRequired({ provider: oauthDetails.provider });
                    }

                    try {
                        // Transaction now returns AuthUser | undefined (or the specific type from findUserById)
                        const createdUserData = await db.transaction().execute(async (trx: Transaction<DB>) => {
                            const authRepoTx = createAuthRepository({ db: trx });
                            const orgRepoTx = createOrganizationRepository({ db: trx });
            
                            const newUserInsert: Insertable<AuthUser> = {
                                password_hash: 'oauth_no_password', // Placeholder - MUST NOT be usable for password login
                                email: oauthDetails.email!, // Use non-null assertion
                                username: oauthDetails.username, 
                                email_verified: true, // If email is provided via OAuth, assume verified by provider
                                role: 'USER' // Default role
                            };
                            
                            // createUser likely returns AuthUser | undefined
                            const createdUser = await authRepoTx.createUser({ user: newUserInsert });
                            if (!createdUser) {
                                // Throw error inside transaction to trigger rollback
                                throw new AppError('Failed to create user during OAuth callback transaction', 500);
                            }
                            const createdUserId = createdUser.id; // Assuming id is number
                            
                            // Create default organization
                            const org = await orgRepoTx.createOrganization({
                                name: `${createdUser.username}'s org`
                            });
                            if (!org) { // Check org creation
                                 throw new AppError('Failed to create organization during OAuth callback transaction', 500);
                            }

                            // Create default membership
                            const membership = await orgRepoTx.createMembership({
                                organization_id: org.id,
                                user_id: createdUserId,
                                is_default: true,
                                role: 'owner'
                            });
                             if (!membership) { // Check membership creation
                                 throw new AppError('Failed to create membership during OAuth callback transaction', 500);
                            }
                            
                            // Link the new OAuth account
                            const linkedAccount = await authRepoTx.linkOAuthAccount({ 
                                account: { 
                                    user_id: createdUserId,
                                    provider: oauthDetails.provider,
                                    provider_user_id: oauthDetails.providerUserId
                                }
                            });
                             if (!linkedAccount) { // Check linking
                                 throw new AppError('Failed to link OAuth account during transaction', 500);
                            }

                            console.log(`OAuth Login: Created new user ${createdUserId}, org ${org.id}, membership, and linked ${oauthDetails.provider} account ${oauthDetails.providerUserId} in transaction.`);
                            
                            // Fetch the complete user record from the transaction context before returning
                            // findUserById likely returns AuthUser | undefined
                            const finalUser = await authRepoTx.findUserById(createdUserId);
                            if (!finalUser) {
                                throw new AppError('Failed to fetch newly created user within transaction', 500);
                            }
                            return finalUser; // Return the full user data from the transaction
                        });

                        // Assign the user data returned from the successful transaction
                        // createdUserData is AuthUser | undefined here
                        if (!createdUserData) {
                            // Should be caught by errors within transaction, but for type safety:
                            throw new AppError('Transaction succeeded but returned no user data', 500);
                        }
                        user = createdUserData;
                        // userId = user.id; // Assign userId after confirming user is not null

                    } catch (error) {
                        console.error("OAuth user creation transaction failed:", error);
                        // Propagate a more generic error or handle specific cases
                        if (error instanceof AppError) throw error;
                        throw new AppError("Failed to complete sign-up process.", 500);
                    }
                }
            } else {
                // OAuth provider didn't give us an email (e.g., private GitHub email)
                // We cannot reliably find an existing user or create a new one without an email.
                // You might need to prompt the user for an email on the frontend 
                // or handle this case differently based on your requirements.
                throw createAppError.auth.oauthEmailRequired({ provider: oauthDetails.provider });
            }
        }

        // By this point, we should have a valid user object (either found or created)
        if (!user) {
            // This check narrows user type to AuthUser below
            throw new AppError('Failed to retrieve user details after OAuth process.', 500);
        }

        const { token } = await createSession({ userId: user.id });

        return {
            user: user,
            sessionToken: token
        };
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
        handleOAuthCallback
    };
}