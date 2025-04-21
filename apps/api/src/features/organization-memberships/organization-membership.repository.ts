import { Kysely, Insertable, Transaction, Selectable } from 'kysely'
import { jsonObjectFrom } from 'kysely/helpers/postgres'
import { DB, OrganizationsInvitation, OrganizationsMembership, OrganizationsOrganization } from '../../db/db-types'


export type OrganizationMembershipRepository = ReturnType<typeof createOrganizationMembershipRepository>

export function createOrganizationMembershipRepository({ db }: { db: Kysely<DB> | Transaction<DB> } ) {
  return {
    findAllOrganizationMembershipsByUserId: async ({userId}: {userId: number}) => {
      return db
        .selectFrom('organizations.memberships')
        .where('user_id', '=', userId)
        .selectAll()
        .select((eb) => [
          jsonObjectFrom(
            eb.selectFrom('organizations.organizations')
              .selectAll()
              .whereRef('organizations.organizations.id', '=', 'organizations.memberships.organization_id')
          ).as('organization')
        ])
        .execute();
    },

    findMembershipByUserIdAndOrgId: async ({userId, organizationId}: {userId: number, organizationId: number}) => {
      return db
        .selectFrom('organizations.memberships')
        .where('user_id', '=', userId)
        .where('organization_id', '=', organizationId)
        .selectAll()
        .executeTakeFirstOrThrow();

    },

    deleteMembership: async ({organizationId, userId}: {organizationId: number, userId: number}) => {
      return await db
        .deleteFrom('organizations.memberships')
        .where('organization_id', '=', organizationId)
        .where('user_id', '=', userId)
        .executeTakeFirstOrThrow();
    },

    createMembership: async ({organizationMembership}: {organizationMembership: Insertable<OrganizationsMembership>}) => {
      const result = await db
        .insertInto('organizations.memberships')
        .values({
          organization_id: organizationMembership.organization_id,
          user_id: organizationMembership.user_id,
          role: organizationMembership.role
        })
        .returningAll()
        .executeTakeFirstOrThrow()
      return result
    },
    
    deleteOrganization: async ({organizationId}: {organizationId: number}) => {
      return await db
        .deleteFrom('organizations.organizations')
        .where('id', '=', organizationId)
        .returningAll()
        .executeTakeFirstOrThrow();
    },

    deleteOrganizationMembership: async ({organizationId, userId}: {organizationId: number, userId: number}) => {
      return await db
        .deleteFrom('organizations.memberships')
        .where('organization_id', '=', organizationId)
        .where('user_id', '=', userId)
        .returningAll()
        .executeTakeFirstOrThrow();
    },

    // update the membership of the user/org combo to have is_default = true
    updateMembershipDefaultStatus: async ({userId, organizationId, isDefault}: {userId: number, organizationId: number, isDefault: boolean}) => {
      return await db
        .updateTable('organizations.memberships')
        .set({ is_default: isDefault })
        .where('user_id', '=', userId)
        .where('organization_id', '=', organizationId)
        .returningAll()
        .executeTakeFirstOrThrow();
    },

    findDefaultMembershipByUserId: async ({userId}: {userId: number}) => {
      return await db
        .selectFrom('organizations.memberships')
        .where('user_id', '=', userId)
        .where('is_default', '=', true)
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
    }
  }
} 