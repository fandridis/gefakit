import { Kysely } from 'kysely'
import { DB } from '../../db/db-types'
import { CreateOrganizationRequestBodyDTO, OrganizationDTO } from '@gefakit/shared/src/types/organization'
import { createOrganizationService } from './organizations.service';
import { AppError } from '../../errors/app-error';

export function createOrganizationController(db: Kysely<DB>) {
  const organizationService = createOrganizationService(db);
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