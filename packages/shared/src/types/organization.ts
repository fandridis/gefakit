import { z } from "zod";
import { createOrganizationInvitationRequestBodySchema, createOrganizationRequestBodySchema, organizationInvitationSchema, organizationMembershipSchema, organizationSchema, updateOrganizationRequestBodySchema } from "../schemas/organization.schema";

export type OrganizationDTO = z.infer<typeof organizationSchema>
export type OrganizationMembershipDTO = z.infer<typeof organizationMembershipSchema>
export type OrganizationInvitationDTO = z.infer<typeof organizationInvitationSchema>

export type CreateOrganizationRequestBodyDTO = z.infer<typeof createOrganizationRequestBodySchema>
export type CreateOrganizationResponseDTO = { createdOrganization: OrganizationDTO }

export type UpdateOrganizationRequestBodyDTO = z.infer<typeof updateOrganizationRequestBodySchema>
export type UpdateOrganizationResponseDTO = { updatedOrganization: OrganizationDTO }

export type DeleteOrganizationResponseDTO = { deletedOrganization: OrganizationDTO }

export type GetOrganizationMembershipsResponseDTO = { memberships: OrganizationMembershipDTO[] }

export type DeleteOrganizationMembershipResponseDTO = { success: boolean }

export type CreateOrganizationInvitationRequestBodyDTO = z.infer<typeof createOrganizationInvitationRequestBodySchema>
export type CreateOrganizationInvitationResponseDTO = { createdInvitation: OrganizationInvitationDTO }

export type DeleteOrganizationInvitationResponseDTO = { success: boolean }