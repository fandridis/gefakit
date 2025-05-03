import { Insertable, Kysely, Transaction } from 'kysely'
import { DB, OrganizationsInvitation } from '../../db/db-types'
import { OrganizationInvitationRepository } from './organization-invitation.repository';
import { OrganizationService } from '../organizations/organization.service';
import { AuthService } from '../auth/auth.service';
import { authErrors } from '../auth/auth.errors';
import { organizationInvitationErrors } from './organization-invitation.errors';
export type OrganizationInvitationService = ReturnType<typeof createOrganizationInvitationService>

export function createOrganizationInvitationService({ 
  db, 
  organizationInvitationRepository, 
  createOrganizationInvitationRepository,
  organizationService,
  authService
}: { 
  db: Kysely<DB>, 
  organizationInvitationRepository: OrganizationInvitationRepository, 
  createOrganizationInvitationRepository: (args: { db: Kysely<DB> | Transaction<DB> }) => OrganizationInvitationRepository,
  organizationService: OrganizationService,
  authService: AuthService
}) {
  return {
    findAllInvitationsByUserId: async ({userId}: {userId: number}) => {
      // Get the user to find his email and then fetch all invitations for that email
      const user = await authService.findUserById({id: userId});
      if (!user) {
        throw authErrors.userNotFound();
      }
      return await organizationInvitationRepository.findAllInvitationsByUserEmail({email: user.email});
    },

    findInvitationByToken: async ({token}: {token: string}) => {
      return await organizationInvitationRepository.findInvitationByToken({token});
    },

    acceptInvitation: async ({token, acceptingUserId}: {token: string, acceptingUserId: number}) => {
      const invitation = await organizationInvitationRepository.findInvitationByToken({token});

      if (!invitation) {
        throw organizationInvitationErrors.invitationNotFound();
      }

      if (invitation.expires_at < new Date()) {
        throw organizationInvitationErrors.invitationExpired();
      }

      if (invitation.status !== 'pending') {
        throw organizationInvitationErrors.invitationAlreadyProcessed();
      }

      return db.transaction().execute(async (trx: Transaction<DB>) => {
        const organizationInvitationRepoTx = createOrganizationInvitationRepository({ db: trx });

        const acceptedInvitation = await organizationInvitationRepoTx.acceptInvitation({token});

        if (!acceptedInvitation) {
          throw organizationInvitationErrors.invitationNotFound();
        }

        await organizationService.createMembershipFromInvitation({
          invitation: acceptedInvitation,
          acceptingUserId,
          trx
        });

        return acceptedInvitation;
      });
    },

    declineInvitation: async ({token}: {token: string}) => {
      const invitation = await organizationInvitationRepository.findInvitationByToken({token});
      
      if (!invitation) {
        throw organizationInvitationErrors.invitationNotFound();
      }

      if (invitation.expires_at < new Date()) {
        throw organizationInvitationErrors.invitationExpired();
      }

      if (invitation.status !== 'pending') {
        throw organizationInvitationErrors.invitationAlreadyProcessed();
      }
      
      const declinedInvitation = await organizationInvitationRepository.declineInvitation({token});

      if (!declinedInvitation) {
        throw organizationInvitationErrors.invitationNotFound();
      }

      return declinedInvitation;
    },

    deleteInvitation: async ({token}: {token: string}) => {
      return await organizationInvitationRepository.deleteInvitation({token});
    },

    createInvitation: async ({organizationInvitation}: {organizationInvitation: Insertable<OrganizationsInvitation>}) => {
      return await organizationInvitationRepository.createInvitation({organizationInvitation});
    },
  }
} 
