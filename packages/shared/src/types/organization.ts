import { z } from "zod";
import { createOrganizationInvitationRequestBodySchema, createOrganizationRequestBodySchema, organizationSchema, updateOrganizationRequestBodySchema } from "../schemas/organization.schema";
import { membershipSchema } from "../schemas/membership.schema";
import { invitationSchema } from "../schemas/invitation.schema";

export type OrganizationDTO = z.infer<typeof organizationSchema>
export type OrganizationMembershipDTO = z.infer<typeof membershipSchema>
export type OrganizationInvitationDTO = z.infer<typeof invitationSchema>

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