import { Hono } from 'hono'
import { Bindings } from '../../types/hono'
import { zValidator } from '../../lib/zod-validator';
import { createOrganizationInvitationRequestBodySchema, createOrganizationRequestBodySchema } from '@gefakit/shared/src/schemas/organization.schema';
import { CreateOrganizationInvitationResponseDTO, CreateOrganizationResponseDTO, DeleteOrganizationMembershipResponseDTO, DeleteOrganizationResponseDTO } from '@gefakit/shared/src/types/organization';
import { Kysely } from 'kysely';
import { DB } from '../../db/db-types';
import { OrganizationService } from './organization.service';
import { EmailService } from '../emails/email.service';
import { OrganizationMembershipService } from '../organization-memberships/organization-membership.service';
import { OrganizationInvitationService } from '../organization-invitations/organization-invitation.service';
import { randomUUID } from 'node:crypto';
import { getEmailService, getOrganizationInvitationService, getOrganizationMembershipService, getOrganizationService } from '../../utils/get-service';
import { organizationErrors } from './organization.errors';
import { AppVariables } from '../../create-app';
import { getAuthOrThrow } from '../../utils/get-auth-or-throw';


export function createOrganizationRoutesV1() {
  const app = new Hono<{ Bindings: Bindings; Variables: AppVariables }>()


  // POST - create a new organization
  app.post('/', zValidator('json', createOrganizationRequestBodySchema), async (c) => {
    const body = c.req.valid('json');
    const { user } = getAuthOrThrow(c);
    const organizationService = getOrganizationService(c);

    const organization = await organizationService.createOrganization({data: body, userId: user.id});
    const response: CreateOrganizationResponseDTO = { createdOrganization: organization};

    return c.json(response, 201);
  })

  // DELETE - an organization
  app.delete('/:orgId', async (c) => {
    const { user } = getAuthOrThrow(c);
    const orgId = c.req.param('orgId');
    const organizationService = getOrganizationService(c);

    const organization = await organizationService.deleteOrganization({organizationId: parseInt(orgId), userId: user.id});

    const response: DeleteOrganizationResponseDTO = { deletedOrganization: organization};
    return c.json(response, 200);
  })

  // DELETE - current user's membership from a specific org
  app.delete('/:orgId/memberships/me', async (c) => {
    const { user } = getAuthOrThrow(c);
    const orgId = c.req.param('orgId');
    const organizationMembershipService = getOrganizationMembershipService(c);

    await organizationMembershipService.removeCurrentUserMembershipFromOrg({organizationId: parseInt(orgId), userId: user.id});
    const response = { success: true };

    return c.json(response, 200);
  })

  // DELETE - a specific organization membership
  app.delete('/:orgId/memberships/:membershipId', async (c) => {
    const orgId = c.req.param('orgId');
    const membershipId = c.req.param('membershipId');
    const organizationMembershipService = getOrganizationMembershipService(c);

    await organizationMembershipService.removeUserMembershipFromOrg({organizationId: parseInt(orgId), userId: parseInt(membershipId)});
    const response = { success: true };

    return c.json(response, 200);
  })

  // POST - invite user by email to the organization
  app.post('/:orgId/invitations', zValidator('json', createOrganizationInvitationRequestBodySchema), async (c) => {
    const { user } = getAuthOrThrow(c);
    const orgId = c.req.param('orgId');
    const body = c.req.valid('json');

    const organizationService = getOrganizationService(c);
    const organizationInvitationService = getOrganizationInvitationService(c);
    const emailService = getEmailService(c);

    // get the organization
    const organization = await organizationService.findOrganizationById({organizationId: parseInt(orgId)});

    if (!organization) {
      throw organizationErrors.organizationNotFound();
    }

    const invitation = await organizationInvitationService.createInvitation({
      organizationInvitation: {
        organization_id: parseInt(orgId),
        invited_by_user_id: user.id,
        role: 'member',
        email: body.email,
        expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7), // 1 week from now
        token: randomUUID()
      }
    });
    
    await emailService.sendOrganizationInvitationEmail({
      email: invitation.email,
      orgName: organization.name,
      token: invitation.token
    });

    const response: CreateOrganizationInvitationResponseDTO = { createdInvitation: invitation};
    return c.json(response, 201);
  })

  // PUT - set a specific organization as active/default for the user
  app.put('/memberships/active/:orgId', async (c) => {
    const { user } = getAuthOrThrow(c);
    const orgId = c.req.param('orgId');
    const organizationService = getOrganizationService(c);

    await organizationService.updateMembershipDefaultStatus({userId: user.id, organizationId: parseInt(orgId)});

    const response = { success: true};
    return c.json(response, 200);
  })

  return app;
} 