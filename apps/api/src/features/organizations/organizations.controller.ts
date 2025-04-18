import { Kysely, Selectable } from 'kysely'
import { DB, OrganizationsMembership, OrganizationsOrganization } from '../../db/db-types'
import { CreateOrganizationRequestBodyDTO } from '@gefakit/shared/src/types/organization'
import { OrganizationService, createOrganizationService } from './organizations.service';
import { AppError } from '../../errors/app-error';
import { EmailService, createEmailService } from '../emails/email.service';
import { AuthService, createAuthService } from '../auth/auth.service';
import { createAppError } from '../../errors';

export type OrganizationController = ReturnType<typeof createOrganizationController>

export function createOrganizationController({
  organizationService,
  emailService,
  authService,
}: {
  organizationService: OrganizationService;
  emailService: EmailService;
  authService: AuthService;
}) {
  return {
    findAllOrganizationMembershipsByUserId: async (userId: number) => {
      try {
        const result = await organizationService.findAllOrganizationMembershipsByUserId(userId);
        return { memberships: result };
      } catch (err) {
        if (err instanceof AppError) {
          throw err;
        }
        console.error("Unexpected error in controller.findAllOrganizationMembershipsByUserId:", err);
        throw err;
      }
    },

    createOrganization: async (data: CreateOrganizationRequestBodyDTO, userId: number) => {
      try {
        const result = await organizationService.createOrganization(data, userId);

        const user = await authService.findUserById(userId);

        if (!user) {
          throw createAppError.auth.userNotFound()
        }

        await emailService.sendOrganizationCreatedEmail({
          email: user.email,
          orgName: data.name,
        });
        return { organization: result };
      } catch (err) {
        if (err instanceof AppError) {
          throw err;
        }
        console.error("Unexpected error in controller.createOrganization:", err);
        throw err;
      }
    },

    deleteOrganization: async (orgId: number, userId: number) => {
      try {
        const result = await organizationService.deleteOrganization(orgId, userId);
        return { organization: result };
      } catch (err) {
        if (err instanceof AppError) {
          throw err;
        }
        console.error("Unexpected error in controller.deleteOrganization:", err);
        throw err;
      }
    },

    deleteOrganizationMembership: async (orgId: number, userId: number) => {
      try {
        const result = await organizationService.deleteOrganizationMembership(orgId, userId);
        return { organizationMembership: result };
      } catch (err) {
        if (err instanceof AppError) {
          throw err;
        }
        console.error("Unexpected error in controller.deleteOrganizationMembership:", err);
        throw err;
      }
    }
  }
}

// Remove the inferred type export
// export type OrganizationController = ReturnType<typeof createOrganizationController>; 