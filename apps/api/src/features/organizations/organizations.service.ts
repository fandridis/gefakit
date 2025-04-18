import { Kysely, Insertable, Transaction, Selectable } from 'kysely'
import { DB, OrganizationsOrganization, OrganizationsMembership } from '../../db/db-types'
import { createOrganizationRepository, OrganizationRepository } from './organizations.repository';
import { createAppError } from '../../errors';

export type OrganizationService = ReturnType<typeof createOrganizationService>

export function createOrganizationService({ db, organizationRepository }: { db: Kysely<DB>, organizationRepository: OrganizationRepository }) {
  return {
    findAllOrganizationMembershipsByUserId: async (userId: number) => {
      return await organizationRepository.findAllOrganizationMembershipsByUserId(userId);
    },

    createOrganization: async (data: Insertable<OrganizationsOrganization>, userId: number) => {
      return await db.transaction().execute(async (trx: Transaction<DB>) => {
        const orgRepoTx = createOrganizationRepository({db: trx});
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
      const memberships = await organizationRepository.findAllOrganizationMembershipsByUserId(userId);
      if (memberships.length === 1 && memberships[0].organization_id === orgId) {
        throw createAppError.organizations.actionNotAllowed('Cannot delete your only organization...');
      }

      return await db.transaction().execute(async (trx) => {
        const repoTx = createOrganizationRepository({ db: trx });
        const organization = await repoTx.findOrganizationById(orgId);

        if (!organization) {
          throw createAppError.organizations.organizationNotFound();
        }
  
        const isOwner = organization.ownerMembership?.user_id === userId;
  
        if (!isOwner) {
          throw createAppError.organizations.actionNotAllowed('Only the owner can delete the organization');
        }
  
        return await repoTx.deleteOrganization(orgId); 
      });
    },

    deleteOrganizationMembership: async (orgId: number, userId: number) => {
      const organization = await organizationRepository.findOrganizationById(orgId);

      if (!organization) {
        throw createAppError.organizations.organizationNotFound();
      }

      if (organization.ownerMembership?.user_id === userId) {
        throw createAppError.organizations.actionNotAllowed('Cannot leave the organization as the owner');
      }

      return await organizationRepository.deleteOrganizationMembership(orgId, userId);
    },

    updateMembershipDefaultStatus: async (userId: number, orgId: number) => {
      return await db.transaction().execute(async (trx) => {
        const repoTx = createOrganizationRepository({ db: trx });

        // Find the current default membership
        const currentDefault = await repoTx.findDefaultMembershipByUserId(userId);

        // If there is a current default and it's not the one we're trying to set,
        // unset it first.
        if (currentDefault && currentDefault.organization_id !== orgId) {
          await repoTx.updateMembershipDefaultStatus(userId, currentDefault.organization_id, false);
        }

        // Set the new default organization
        return await repoTx.updateMembershipDefaultStatus(userId, orgId, true);
      });
    },

    findDefaultMembershipByUserId: async (userId: number) => {
      return await organizationRepository.findDefaultMembershipByUserId(userId);
    }
  }
} 