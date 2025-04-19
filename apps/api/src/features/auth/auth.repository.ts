import { Insertable, Kysely, Transaction } from "kysely";
import { AuthSession, AuthUser, DB, AuthEmailVerification } from "../../db/db-types";

type DbClient = Kysely<DB> | Transaction<DB>

export type AuthRepository = ReturnType<typeof createAuthRepository>;

export function createAuthRepository({ db }: { db: DbClient }) {
    return {
        async findUserById(id: number) {
            return db
                .selectFrom('auth.users')
                .where('id', '=', id)
                .select(['id', 'email', 'username', 'created_at', 'email_verified'])
                .executeTakeFirst();
        },

        async findUserWithPasswordByEmail(data: { email: string }) {
            return db
                .selectFrom('auth.users')
                .where('email', '=', data.email)
                .select(['id', 'email', 'username', 'password_hash', 'created_at', 'email_verified'])
                .executeTakeFirst();
        },

        async createUser(insertableUser: Insertable<AuthUser>) {
            return db
                .insertInto('auth.users')
                .values(insertableUser)
                .returning(['id', 'email', 'username', 'created_at', 'email_verified'])
                .executeTakeFirst();
        },

        async createSession(data: Insertable<AuthSession>) {
            return db
                .insertInto('auth.sessions')
                .values(data)
                .returning(['id', 'user_id', 'expires_at'])
                .executeTakeFirst();
        },

        async findSessionWithUser(data: { sessionId: string }) {
            return db
                .selectFrom('auth.sessions')
                .innerJoin('auth.users', 'auth.users.id', 'auth.sessions.user_id')
                .select([
                    'auth.sessions.id',
                    'auth.sessions.user_id',
                    'auth.sessions.expires_at',
                    'auth.users.id as user_id',
                    'auth.users.email',
                    'auth.users.username',
                    'auth.users.created_at',
                    'auth.users.email_verified'
                ])
                .where('auth.sessions.id', '=', data.sessionId)
                .executeTakeFirst();
        },

        async updateSessionExpiry(data: { sessionId: string; expiresAt: Date }) {
            return db
                .updateTable('auth.sessions')
                .set({ expires_at: data.expiresAt })
                .where('id', '=', data.sessionId)
                .execute();
        },

        async deleteSession(data: { sessionId: string }) {
            return db
                .deleteFrom('auth.sessions')
                .where('id', '=', data.sessionId)
                .execute();
        },

        async deleteAllUserSessions(data: { userId: number }) {
            return db
                .deleteFrom('auth.sessions')
                .where('user_id', '=', data.userId)
                .execute();
        },

        async createEmailVerificationToken(data: Insertable<AuthEmailVerification>) {
            return db
                .insertInto('auth.email_verifications')
                .values(data)
                .returning(['id', 'user_id', 'value', 'expires_at'])
                .executeTakeFirst();
        },

        async findEmailVerificationTokenByValue(data: { tokenValue: string }) {
            return db
                .selectFrom('auth.email_verifications')
                .selectAll()
                .where('value', '=', data.tokenValue)
                .executeTakeFirst();
        },

        async updateUserEmailVerified(data: { userId: number; verified: boolean }) {
            return db
                .updateTable('auth.users')
                .set({ email_verified: data.verified })
                .where('id', '=', data.userId)
                .returning(['id', 'email_verified'])
                .executeTakeFirst();
        },

        async deleteEmailVerificationToken(data: { tokenId: string }) {
            return db
                .deleteFrom('auth.email_verifications')
                .where('id', '=', data.tokenId)
                .execute();
        }
    };
}
