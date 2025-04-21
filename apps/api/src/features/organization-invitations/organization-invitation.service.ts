import { Insertable, Kysely, Transaction } from 'kysely'
import { DB, OrganizationsInvitation } from '../../db/db-types'
import { OrganizationInvitationRepository } from './organization-invitation.repository';
import { createAppError } from '../../errors';
import { OrganizationService } from '../organizations/organization.service';
import { AuthService } from '../auth/auth.service';
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
        throw createAppError.auth.userNotFound();
      }
      return await organizationInvitationRepository.findAllInvitationsByUserEmail({email: user.email});
    },

    findInvitationByToken: async ({token}: {token: string}) => {
      return await organizationInvitationRepository.findInvitationByToken({token});
    },

    acceptInvitation: async ({token, acceptingUserId}: {token: string, acceptingUserId: number}) => {
      console.log('[Service] Accepting invitation', { token, acceptingUserId });
      // Use the injected instance for the initial read (outside transaction)
      const invitation = await organizationInvitationRepository.findInvitationByToken({token});

      if (!invitation) {
        throw createAppError.organizationInvitations.invitationNotFound();
      }

      if (invitation.expires_at < new Date()) {
        throw createAppError.organizationInvitations.actionNotAllowed('Invitation expired');
      }

      if (invitation.status !== 'pending') {
        throw createAppError.organizationInvitations.actionNotAllowed('Invitation already accepted/declined');
      }

      // Start the transaction
      return db.transaction().execute(async (trx: Transaction<DB>) => {
        // Create a transaction-scoped invitation repository using the factory
        const organizationInvitationRepoTx = createOrganizationInvitationRepository({ db: trx });

        // Accept the invitation using the tx-scoped repo
        const acceptedInvitation = await organizationInvitationRepoTx.acceptInvitation({token});

        if (!acceptedInvitation) {
          // Ensure the error is thrown to trigger transaction rollback
          throw createAppError.organizationInvitations.invitationNotFound();
        }

        // Delegate membership creation to OrganizationService, passing the transaction
        // Pass arguments as a single object
        await organizationService.createMembershipFromInvitation({
          invitation: acceptedInvitation, // Pass the accepted invitation object
          acceptingUserId, // Pass the user ID
          trx // Pass the transaction object
        });

        // Return the result (or potentially more info after membership creation)
        return acceptedInvitation;
      });
    },

    declineInvitation: async ({token}: {token: string}) => {
      console.log('[Service] Declining invitation', { token });
      // get the invitation by token
      const invitation = await organizationInvitationRepository.findInvitationByToken({token});
      
      if (!invitation) {
        throw createAppError.organizationInvitations.invitationNotFound();
      }

      if (invitation.expires_at < new Date()) {
        throw createAppError.organizationInvitations.actionNotAllowed('Invitation expired');
      }

      if (invitation.status !== 'pending') {
        throw createAppError.organizationInvitations.actionNotAllowed('Invitation already accepted/declined');
      }
      
      const declinedInvitation = await organizationInvitationRepository.declineInvitation({token});

      if (!declinedInvitation) {
        throw createAppError.organizationInvitations.invitationNotFound();
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
