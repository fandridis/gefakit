import { Kysely, Insertable, ExpressionBuilder, Transaction } from 'kysely'
import { jsonObjectFrom } from 'kysely/helpers/postgres'
import { DB, OrganizationsMembership, OrganizationsOrganization } from '../../db/db-types'

type DbClient = Kysely<DB> | Transaction<DB>

export function createOrganizationRepository(db: DbClient) {
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
    
    // createOrganizationAndOwnerMembership: async (orgData: any, userId: number) => {
    //   return await db.transaction().execute(async (trx) => {
    //     const newOrganization = await trx
    //       .insertInto('organizations.organizations')
    //       .values({
    //         name: orgData.name,
    //       })
    //       .returningAll()
    //       .executeTakeFirstOrThrow();

    //     const membershipData: Insertable<OrganizationsMembership> = {
    //       organization_id: newOrganization.id,
    //       user_id: userId,
    //       role: 'owner'
    //     };

    //     await trx
    //       .insertInto('organizations.memberships')
    //       .values(membershipData)
    //       .executeTakeFirstOrThrow();

    //     return newOrganization; 
    //   });
    // },

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
    }
  }
} 