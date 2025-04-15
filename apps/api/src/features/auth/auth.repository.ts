import { Insertable, Kysely } from "kysely";
import { AppUser, DB, UserSession } from "../../db/db-types";

export function createAuthRepository(db: Kysely<DB>) {
    return {
        async findUserWithPasswordByEmail(data: { email: string }) {
            return db
                .selectFrom('app_user')
                .where('email', '=', data.email)
                .select(['id', 'email', 'username', 'password_hash', 'created_at'])
                .executeTakeFirst();
        },

        async createUser(data: Insertable<AppUser>) {
            return db
                .insertInto('app_user')
                .values(data)
                .returning(['id', 'email', 'username', 'created_at'])
                .executeTakeFirst();
        },

        async createSession(data: Insertable<UserSession>) {
            return db
                .insertInto('user_session')
                .values(data)
                .returning(['id', 'user_id', 'expires_at'])
                .executeTakeFirst();
        },

        async findSessionWithUser(data: { sessionId: string }) {
            return db
                .selectFrom('user_session')
                .innerJoin('app_user', 'app_user.id', 'user_session.user_id')
                .select([
                    'user_session.id',
                    'user_session.user_id',
                    'user_session.expires_at',
                    'app_user.id as user_id',
                    'app_user.email',
                    'app_user.username',
                    'app_user.created_at'
                ])
                .where('user_session.id', '=', data.sessionId)
                .executeTakeFirst();
        },

        async updateSessionExpiry(data: { sessionId: string; expiresAt: Date }) {
            return db
                .updateTable('user_session')
                .set({ expires_at: data.expiresAt })
                .where('id', '=', data.sessionId)
                .execute();
        },

        async deleteSession(data: { sessionId: string }) {
            return db
                .deleteFrom('user_session')
                .where('id', '=', data.sessionId)
                .execute();
        },

        async deleteAllUserSessions(data: { userId: number }) {
            return db
                .deleteFrom('user_session')
                .where('user_id', '=', data.userId)
                .execute();
        }
    };
}
