import { Kysely } from 'kysely'
import { DB } from '../../db/db-types'
import { OrganizationMembershipRepository } from './organization-membership.repository';
import { createApiError } from '../../core/api-error';

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
        throw createApiError.organizations.actionNotAllowed('User is not a member of the organization');
      }

      if (membership.role === 'owner') {
        throw createApiError.organizations.actionNotAllowed('You cannot leave the organization as the owner');
      }

      if (memberships.length === 1) {
        throw createApiError.organizations.actionNotAllowed('You cannot leave your only organization');
      }
      
      return await organizationMembershipRepository.deleteMembership({organizationId, userId});
    },

    removeUserMembershipFromOrg: async ({organizationId, userId}: {organizationId: number, userId: number}) => {
      const membership = await organizationMembershipRepository.findMembershipByUserIdAndOrgId({userId, organizationId});

      if (!membership) {
        throw createApiError.organizations.actionNotAllowed('User is not a member of the organization');
      }
      
      if (membership.role !== 'admin' && membership.role !== 'owner') {
        throw createApiError.organizations.actionNotAllowed('Only admins or owners can remove users from the organization');
      }

      return await organizationMembershipRepository.deleteMembership({organizationId, userId});
    },
  }
} 