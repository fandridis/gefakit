import { Insertable, Kysely, Transaction } from "kysely";
import { AuthSession, AuthUser, DB, AuthEmailVerification, AuthOauthAccount, AuthPasswordResetToken, AuthOtpCode } from "../../db/db-types";

export type AuthRepository = ReturnType<typeof createAuthRepository>;

export function createAuthRepository({ db }: { db: Kysely<DB> | Transaction<DB> }) {
    return {
        async findUserById(id: number) {
            return db
                .selectFrom('auth.users')
                .where('id', '=', id)
                .select(['id', 'email', 'username', 'created_at', 'email_verified', 'role'])
                .executeTakeFirst();
        },

        async findUserByEmail({ email }: { email: string }) {
            return db
                .selectFrom('auth.users')
                .where('email', '=', email)
                .select(['id', 'email', 'username', 'created_at', 'email_verified', 'role'])
                .executeTakeFirst();
        },

        async findUserWithPasswordByEmail({ email }: { email: string }) {
            return db
                .selectFrom('auth.users')
                .where('email', '=', email)
                .select(['id', 'email', 'username', 'password_hash', 'created_at', 'email_verified', 'role'])
                .executeTakeFirst();
        },

        async createUser({ user }: { user: Insertable<AuthUser> }) {
            return db
                .insertInto('auth.users')
                .values(user)
                .returning(['id', 'email', 'username', 'created_at', 'email_verified', 'role'])
                .executeTakeFirst();
        },

        async createSession({ session }: { session: Insertable<AuthSession> }) {
            return db
                .insertInto('auth.sessions')
                .values(session)
                .returning(['id', 'user_id', 'expires_at'])
                .executeTakeFirst();
        },

        async findSessionWithUser({ sessionId }: { sessionId: string }) {
            return db
                .selectFrom('auth.sessions')
                .innerJoin('auth.users', 'auth.users.id', 'auth.sessions.user_id')
                .select([
                    'auth.sessions.id',
                    'auth.sessions.user_id',
                    'auth.sessions.expires_at',
                    'auth.sessions.impersonator_user_id',
                    'auth.users.id as user_id',
                    'auth.users.email',
                    'auth.users.username',
                    'auth.users.created_at',
                    'auth.users.email_verified',
                    'auth.users.role'
                ])
                .where('auth.sessions.id', '=', sessionId)
                .executeTakeFirst();
        },

        async updateSessionExpiry({ sessionId, expiresAt }: { sessionId: string; expiresAt: Date }) {
            return db
                .updateTable('auth.sessions')
                .set({ expires_at: expiresAt })
                .where('id', '=', sessionId)
                .execute();
        },

        async updateSessionIdAndExpiry({ oldSessionId, newSessionId, expiresAt }: { oldSessionId: string; newSessionId: string; expiresAt: Date }) {
            return db
                .updateTable('auth.sessions')
                .set({ id: newSessionId, expires_at: expiresAt })
                .where('id', '=', oldSessionId)
                .execute();
        },

        async deleteSession({ sessionId }: { sessionId: string }) {
            return db
                .deleteFrom('auth.sessions')
                .where('id', '=', sessionId)
                .execute();
        },

        async deleteAllUserSessions({ userId }: { userId: number }) {
            return db
                .deleteFrom('auth.sessions')
                .where('user_id', '=', userId)
                .execute();
        },

        async createEmailVerificationToken(data: Insertable<AuthEmailVerification>) {
            return db
                .insertInto('auth.email_verifications')
                .values(data)
                .returning(['id', 'user_id', 'value', 'expires_at'])
                .executeTakeFirst();
        },

        async findEmailVerificationTokenByValue({ tokenValue }: { tokenValue: string }) {
            return db
                .selectFrom('auth.email_verifications')
                .selectAll()
                .where('value', '=', tokenValue)
                .executeTakeFirst();
        },

        async updateUserEmailVerified({ userId, verified }: { userId: number; verified: boolean }) {
            return db
                .updateTable('auth.users')
                .set({ email_verified: verified })
                .where('id', '=', userId)
                .returning(['id', 'email_verified'])
                .executeTakeFirst();
        },

        async deleteEmailVerificationToken({ tokenId }: { tokenId: number }) {
            return db
                .deleteFrom('auth.email_verifications')
                .where('id', '=', tokenId)
                .execute();
        },

        async deleteEmailVerificationTokensByUserId({ userId }: { userId: number }) {
            return db
                .deleteFrom('auth.email_verifications')
                .where('user_id', '=', userId)
                .execute();
        },

        async updateSessionImpersonation({ sessionId, userId, impersonatorUserId }: { sessionId: string, userId: number, impersonatorUserId: number | null }): Promise<boolean> {
            const result = await db
                .updateTable('auth.sessions')
                .set({
                    user_id: userId,
                    impersonator_user_id: impersonatorUserId,
                    // updated_at: new Date(), // Consider adding if you track session updates
                })
                .where('id', '=', sessionId)
                .executeTakeFirst();

            // Kysely returns numUpdatedRows as a bigint, ensure comparison is correct
            return result.numUpdatedRows > 0n;
        },

        async findUserByProviderId({ provider, providerUserId }: { provider: string; providerUserId: string }) {
            return db
                .selectFrom('auth.oauth_accounts')
                .innerJoin('auth.users', 'auth.users.id', 'auth.oauth_accounts.user_id')
                .where('auth.oauth_accounts.provider', '=', provider)
                .where('auth.oauth_accounts.provider_user_id', '=', providerUserId)
                .select([
                    'auth.users.id', 
                    'auth.users.email',
                    'auth.users.username', 
                    'auth.users.created_at', 
                    'auth.users.email_verified', 
                    'auth.users.role'
                ])
                .executeTakeFirst();
        },

        async linkOAuthAccount({ account }: { account: Insertable<AuthOauthAccount> }) {
            return db
                .insertInto('auth.oauth_accounts')
                .values(account)
                .returningAll()
                .executeTakeFirst();
        },

        // --- Password Reset ---

        async createPasswordResetToken(data: Insertable<AuthPasswordResetToken>) {
            return db
                .insertInto('auth.password_reset_tokens')
                .values(data)
                .returning(['id', 'user_id', 'hashed_token', 'expires_at'])
                .executeTakeFirst();
        },

        async findPasswordResetTokenByHashedToken({ hashedToken }: { hashedToken: string }) {
            return db
                .selectFrom('auth.password_reset_tokens')
                .selectAll()
                .where('hashed_token', '=', hashedToken)
                .executeTakeFirst();
        },

        async deletePasswordResetToken({ tokenId }: { tokenId: number }) {
            return db
                .deleteFrom('auth.password_reset_tokens')
                .where('id', '=', tokenId)
                .execute();
        },

        async deletePasswordResetTokensByUserId({ userId }: { userId: number }) {
            return db
                .deleteFrom('auth.password_reset_tokens')
                .where('user_id', '=', userId)
                .execute();
        },

        async updateUserPassword({ userId, passwordHash }: { userId: number; passwordHash: string }) {
            return db
                .updateTable('auth.users')
                .set({ password_hash: passwordHash })
                .where('id', '=', userId)
                .executeTakeFirst(); // Check numUpdatedRows if needed
        },

        // --- OTP Sign In ---

        async createOtpCode(data: Insertable<AuthOtpCode>) {
            return db
                .insertInto('auth.otp_codes')
                .values(data)
                .returning(['id', 'user_id', 'hashed_code', 'expires_at'])
                .executeTakeFirst();
        },

        async findActiveOtpCodeByUserId({ userId }: { userId: number }) {
            return db
                .selectFrom('auth.otp_codes')
                .selectAll()
                .where('user_id', '=', userId)
                .where('expires_at', '>', new Date())
                .orderBy('created_at', 'desc') // Get the latest active one
                .executeTakeFirst();
        },

        async deleteOtpCodeById({ id }: { id: number }) {
            return db
                .deleteFrom('auth.otp_codes')
                .where('id', '=', id)
                .executeTakeFirst(); // Use executeTakeFirst to check numDeletedRows
        },

        async deleteOtpCodesByUserId({ userId }: { userId: number }) {
            return db
                .deleteFrom('auth.otp_codes')
                .where('user_id', '=', userId)
                .execute();
        }
    };
}
