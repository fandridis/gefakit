import { z } from "zod";
import { createOrganizationRequestBodySchema, organizationMembershipSchema, organizationSchema, updateOrganizationRequestBodySchema } from "../schemas/organization.schema";

export type OrganizationDTO = z.infer<typeof organizationSchema>
export type OrganizationMembershipDTO = z.infer<typeof organizationMembershipSchema>

export type CreateOrganizationRequestBodyDTO = z.infer<typeof createOrganizationRequestBodySchema>
export type CreateOrganizationResponseDTO = { createdOrganization: OrganizationDTO }

export type UpdateOrganizationRequestBodyDTO = z.infer<typeof updateOrganizationRequestBodySchema>
export type UpdateOrganizationResponseDTO = { updatedOrganization: OrganizationDTO }

export type DeleteOrganizationResponseDTO = { deletedOrganization: OrganizationDTO }

export type GetOrganizationMembershipsResponseDTO = { memberships: OrganizationMembershipDTO[] }

export type DeleteOrganizationMembershipResponseDTO = { success: boolean }