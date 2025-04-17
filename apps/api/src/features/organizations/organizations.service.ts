import { Kysely, Insertable, Transaction } from 'kysely'
import { DB, OrganizationsOrganization } from '../../db/db-types'
import { createOrganizationRepository } from './organizations.repository';
import { createAppError } from '../../errors';

export function createOrganizationService(db: Kysely<DB>) {
  const repository = createOrganizationRepository(db);
  return {
    findAllOrganizationMembershipsByUserId: async (userId: number) => {
      return await repository.findAllOrganizationMembershipsByUserId(userId);
    },

    createOrganization: async (data: Insertable<OrganizationsOrganization>, userId: number) => {
      return await db.transaction().execute(async (trx: Transaction<DB>) => {
        const orgRepoTx = createOrganizationRepository(trx);
        const organization = await orgRepoTx.createOrganization({
          name: data.name,
        });

        await orgRepoTx.createMembership({
          organization_id: organization.id,
          user_id: userId,
          role: 'owner'
        });

        return organization;
      });
    },

    deleteOrganization: async (orgId: number, userId: number) => {
      
      // Check if this is the user's only organization
      const memberships = await repository.findAllOrganizationMembershipsByUserId(userId);
      if (memberships.length === 1 && memberships[0].organization_id === orgId) {
        throw createAppError.organizations.actionNotAllowed('Cannot delete your only organization...');
      }

      // Fetch the organization to check if the user is the owner
      const organization = await repository.findOrganizationById(orgId);

      if (!organization) {
        throw createAppError.organizations.organizationNotFound();
      }

      // Check if the user is the owner of the organization
      const isOwner = organization.ownerMembership?.user_id === userId;

      if (!isOwner) {
        throw createAppError.organizations.actionNotAllowed('Only the owner can delete the organization');
      }

      return await repository.deleteOrganization(orgId);
    },

    deleteOrganizationMembership: async (orgId: number, userId: number) => {
      // Fetch the organization to check if the user is the owner
      const organization = await repository.findOrganizationById(orgId);

      if (!organization) {
        throw createAppError.organizations.organizationNotFound();
      }

      // If owner, we cannot remove the owner
      if (organization.ownerMembership?.user_id === userId) {
        throw createAppError.organizations.actionNotAllowed('Cannot leave the organization as the owner');
      }

      return await repository.deleteOrganizationMembership(orgId, userId);
    }
  }
} 