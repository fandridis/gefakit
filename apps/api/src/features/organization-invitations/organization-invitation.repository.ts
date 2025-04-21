import { Kysely, Insertable, Transaction, Selectable } from 'kysely'
import { DB, OrganizationsInvitation, } from '../../db/db-types'


export type OrganizationInvitationRepository = ReturnType<typeof createOrganizationInvitationRepository>

export function createOrganizationInvitationRepository({ db }: { db: Kysely<DB> | Transaction<DB> } ) {
  return {
    findAllInvitationsByUserId: async ({userId}: {userId: number}) => {
      return db
        .selectFrom('organizations.invitations')
        .where('invited_by_user_id', '=', userId)
        .selectAll()
        .execute();
    },

    findAllInvitationsByUserEmail: async ({email}: {email: string}) => {
      return db
        .selectFrom('organizations.invitations')
        .where('email', '=', email)
        .selectAll()
        .execute();
    },
    findInvitationByToken: async ({token}: {token: string}) => {
      return db
        .selectFrom('organizations.invitations')
        .where('token', '=', token)
        .selectAll()
        .executeTakeFirst();
    },

    createInvitation: async ({organizationInvitation}: {organizationInvitation: Insertable<OrganizationsInvitation>}) => {
      return await db
        .insertInto('organizations.invitations')
        .values({
          organization_id: organizationInvitation.organization_id,
          invited_by_user_id: organizationInvitation.invited_by_user_id,
          role: organizationInvitation.role,
          email: organizationInvitation.email,
          expires_at: organizationInvitation.expires_at,
          token: organizationInvitation.token
        })
        .returningAll()
        .executeTakeFirstOrThrow();
    },

    acceptInvitation: async ({token}: {token: string}) => {
      return db
        .updateTable('organizations.invitations')
        .set({ status: 'accepted' })
        .where('token', '=', token)
        .returningAll()
        .executeTakeFirst();
    },

    declineInvitation: async ({token}: {token: string}) => {
      return db
        .updateTable('organizations.invitations')
        .set({ status: 'declined' })
        .where('token', '=', token)
        .returningAll()
        .executeTakeFirst();
    },

    deleteInvitation: async ({token}: {token: string}) => {
      return db
        .deleteFrom('organizations.invitations')
        .where('token', '=', token)
        .executeTakeFirstOrThrow();
    },
  }
} 