import { Kysely, Insertable, Transaction, Selectable } from 'kysely'
import { DB, OrganizationsOrganization, OrganizationsMembership, OrganizationsInvitation } from '../../db/db-types'
import { OrganizationRepository } from './organization.repository';
import { organizationErrors } from './organization.errors';

export type OrganizationService = ReturnType<typeof createOrganizationService>

export function createOrganizationService({ 
  db, 
  organizationRepository, 
  createOrganizationRepository 
}: { 
  db: Kysely<DB>, 
  organizationRepository: OrganizationRepository,
  createOrganizationRepository: (args: { db: Kysely<DB> | Transaction<DB> }) => OrganizationRepository 
}) {
  return {
    findOrganizationById: async ({organizationId}: {organizationId: number}) => {
      return await organizationRepository.findOrganizationById({organizationId});
    },

    findAllOrganizationMembershipsByUserId: async ({userId}: {userId: number}) => {
      return await organizationRepository.findAllOrganizationMembershipsByUserId({userId});
    },

    createOrganization: async ({data, userId}: {data: Insertable<OrganizationsOrganization>, userId: number}) => {
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

    deleteOrganization: async ({organizationId, userId}: {organizationId: number, userId: number}) => {
      const memberships = await organizationRepository.findAllOrganizationMembershipsByUserId({userId});
      if (memberships.length === 1 && memberships[0].organization_id === organizationId) {
        throw organizationErrors.actionNotAllowed('Cannot delete your only organization...');
      }

      return await db.transaction().execute(async (trx: Transaction<DB>) => {
        const repoTx = createOrganizationRepository({ db: trx });
        const organization = await repoTx.findOrganizationById({organizationId});

        if (!organization) {
            throw organizationErrors.organizationNotFound();
        }
  
        const isOwner = organization.ownerMembership?.user_id === userId;
  
        if (!isOwner) {
          throw organizationErrors.actionNotAllowed('Only the owner can delete the organization');
        }
  
        return await repoTx.deleteOrganization({organizationId}); 
      });
    },

    deleteOrganizationMembership: async ({organizationId, userId}: {organizationId: number, userId: number}) => {
      const organization = await organizationRepository.findOrganizationById({organizationId});

      if (!organization) {
        throw organizationErrors.organizationNotFound();
      }

      if (organization.ownerMembership?.user_id === userId) {
        throw organizationErrors.actionNotAllowed('Cannot leave the organization as the owner');
      }

      return await organizationRepository.deleteOrganizationMembership({organizationId, userId});
    },

    updateMembershipDefaultStatus: async ({userId, organizationId}: {userId: number, organizationId: number}) => {
      return await db.transaction().execute(async (trx: Transaction<DB>) => {
        const repoTx = createOrganizationRepository({ db: trx });

        // Find the current default membership
        const currentDefault = await repoTx.findDefaultMembershipByUserId({userId});

        // If there is a current default and it's not the one we're trying to set,
        // unset it first.
        if (currentDefault && currentDefault.organization_id !== organizationId) {
          await repoTx.updateMembershipDefaultStatus({userId, organizationId: currentDefault.organization_id, isDefault: false});
        }

        // Set the new default organization
        return await repoTx.updateMembershipDefaultStatus({userId, organizationId, isDefault: true});
      });
    },

    findDefaultMembershipByUserId: async ({userId}: {userId: number}) => {
      return await organizationRepository.findDefaultMembershipByUserId({userId});
    },

    createMembershipFromInvitation: async ({
      invitation,
      acceptingUserId,
      trx
    }: {
      invitation: Selectable<OrganizationsInvitation>,
      acceptingUserId: number, 
      trx?: Transaction<DB>
    }): Promise<Selectable<OrganizationsMembership>> => {
      const organizationRepoTx = createOrganizationRepository({ db: trx || db });

      const newMembership = await organizationRepoTx.createMembership({
        organization_id: invitation.organization_id,
        user_id: acceptingUserId,
        role: invitation.role
      });

      return newMembership;
    },
  }
} 