import { Kysely } from 'kysely'
import { DB } from '../../db/db-types'
import { OrganizationMembershipRepository } from './organization-membership.repository';
import { organizationErrors } from '../organizations/organization.errors';
import { organizationMembershipErrors } from './organization-membership.errors';

export type OrganizationMembershipService = ReturnType<typeof createOrganizationMembershipService>

export function createOrganizationMembershipService({ 
  db, 
  organizationMembershipRepository, 
}: { 
  db: Kysely<DB>, 
  organizationMembershipRepository: OrganizationMembershipRepository,
}) {
  return {
    findAllOrganizationMembershipsByUserId: async ({userId}: {userId: number}) => {
      return await organizationMembershipRepository.findAllOrganizationMembershipsByUserId({userId});
    },

    removeCurrentUserMembershipFromOrg: async ({organizationId, userId}: {organizationId: number, userId: number}) => {
      const memberships = await organizationMembershipRepository.findAllOrganizationMembershipsByUserId({userId});
      const membership = memberships.find((m) => m.organization_id === organizationId);

      if (!membership) {
        throw organizationMembershipErrors.organizationMembershipNotFound();
      }

      if (membership.role === 'owner') {
        throw organizationMembershipErrors.ownerCannotLeaveOrganization();
      }

      if (memberships.length === 1) {
        throw organizationMembershipErrors.cannotLeaveOnlyOrganization();
      }
      
      return await organizationMembershipRepository.deleteMembership({organizationId, userId});
    },

    removeUserMembershipFromOrg: async ({organizationId, userId}: {organizationId: number, userId: number}) => {
      const membership = await organizationMembershipRepository.findMembershipByUserIdAndOrgId({userId, organizationId});

      console.log('gg1 membership', membership);
      if (!membership) {
        throw organizationMembershipErrors.organizationMembershipNotFound();
      }
      
      if (membership.role !== 'admin' && membership.role !== 'owner') {
        throw organizationMembershipErrors.onlyAdminsCanRemoveUsers();
      }

      return await organizationMembershipRepository.deleteMembership({organizationId, userId});
    },
  }
} 