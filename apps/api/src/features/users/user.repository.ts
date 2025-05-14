import { Insertable, Kysely, Transaction, sql, Updateable } from "kysely";
import { AuthSession, AuthUser, DB, AuthEmailVerification, AuthOauthAccount, AuthPasswordResetToken, AuthOtpCode } from "../../db/db-types";

type DbClient = Kysely<DB> | Transaction<DB>

export type UserRepository = ReturnType<typeof createUserRepository>;

export function createUserRepository({ db }: { db: DbClient }) {
    return {
        async findUserById(id: number) {
            return db
                .selectFrom('auth.users')
                .where('id', '=', id)
                .select(['id', 'email', 'username', 'created_at', 'email_verified', 'role', 'stripe_customer_id'])
                .executeTakeFirst();
        },

        async updateUser({ userId, updates }: { userId: number; updates: Updateable<AuthUser> }) {
            const allowedUpdates: Updateable<AuthUser> = { ...updates };
            delete (allowedUpdates as Partial<AuthUser>).password_hash;
            delete (allowedUpdates as Partial<AuthUser>).id;
            delete (allowedUpdates as Partial<AuthUser>).created_at;

            if (Object.keys(allowedUpdates).length === 0) {
                return this.findUserById(userId);
            }

            return db
                .updateTable('auth.users')
                .set(allowedUpdates)
                .where('id', '=', userId)
                .returning(['id', 'email', 'username', 'created_at', 'email_verified', 'role', 'stripe_customer_id'])
                .executeTakeFirst();
        }
    };
}
