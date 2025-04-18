import { Kysely } from 'kysely'
import { DB } from '../../db/db-types'
import { CreateOrganizationRequestBodyDTO } from '@gefakit/shared/src/types/organization'
import { createOrganizationService } from './organizations.service';
import { AppError } from '../../errors/app-error';
import { createEmailService } from '../emails/email.service';
import { createAuthService } from '../auth/auth.service';
import { createAppError } from '../../errors';

export function createOrganizationController(db: Kysely<DB>) {
  const organizationService = createOrganizationService(db);
  const emailService = createEmailService(db);
  const authService = createAuthService(db);

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