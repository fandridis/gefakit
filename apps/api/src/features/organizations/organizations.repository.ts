import { Kysely, Insertable, Transaction, Selectable } from 'kysely'
import { jsonObjectFrom } from 'kysely/helpers/postgres'
import { DB, OrganizationsMembership, OrganizationsOrganization } from '../../db/db-types'


export type OrganizationRepository = ReturnType<typeof createOrganizationRepository>

export function createOrganizationRepository({ db }: { db: Kysely<DB> | Transaction<DB> } ) {
  return {
    findAllOrganizationMembershipsByUserId: async (userId: number) => {
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

    findOrganizationById: async (orgId: number) => {
      return db
        .selectFrom('organizations.organizations')
        .where('organizations.organizations.id', '=', orgId)
        .selectAll()
        .select((eb) => [
          jsonObjectFrom(
            eb.selectFrom('organizations.memberships')
              .selectAll()
              .whereRef('organizations.memberships.organization_id', '=', 'organizations.organizations.id')
              .where('organizations.memberships.role', '=', 'owner')
          ).as('ownerMembership')
        ])
        .executeTakeFirstOrThrow();
    },
    
    createOrganization: async (data: Insertable<OrganizationsOrganization>) => {
      const result = await db
        .insertInto('organizations.organizations')
        .values({
          name: data.name,
        })
        .returningAll()
        .executeTakeFirstOrThrow()

      return result
    },
    createMembership: async (data: Insertable<OrganizationsMembership>) => {
      const result = await db
        .insertInto('organizations.memberships')
        .values({
          organization_id: data.organization_id,
          user_id: data.user_id,
          role: data.role
        })
        .returningAll()
        .executeTakeFirstOrThrow()
      return result
    },
    
    deleteOrganization: async (orgId: number) => {
      return await db
        .deleteFrom('organizations.organizations')
        .where('id', '=', orgId)
        .returningAll()
        .executeTakeFirstOrThrow();
    },

    deleteOrganizationMembership: async (orgId: number, userId: number) => {
      return await db
        .deleteFrom('organizations.memberships')
        .where('organization_id', '=', orgId)
        .where('user_id', '=', userId)
        .returningAll()
        .executeTakeFirstOrThrow();
    },

    // update the membership of the user/org combo to have is_default = true
    updateMembershipDefaultStatus: async (userId: number, orgId: number, isDefault: boolean) => {
      return await db
        .updateTable('organizations.memberships')
        .set({ is_default: isDefault })
        .where('user_id', '=', userId)
        .where('organization_id', '=', orgId)
        .returningAll()
        .executeTakeFirstOrThrow();
    },

    findDefaultMembershipByUserId: async (userId: number) => {
      return await db
        .selectFrom('organizations.memberships')
        .where('user_id', '=', userId)
        .where('is_default', '=', true)
        .selectAll()
        .executeTakeFirst();
    }
    
  }
} 