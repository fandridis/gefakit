import { Hono } from 'hono'
import { Bindings } from '../../types/hono'
import { DbMiddleWareVariables } from '../../middleware/db'
import { AuthMiddleWareVariables } from '../../middleware/auth'
import { zValidator } from '../../lib/zod-utils';
import { createOrganizationInvitationRequestBodySchema, createOrganizationRequestBodySchema } from '@gefakit/shared/src/schemas/organization.schema';
import { CreateOrganizationInvitationResponseDTO, CreateOrganizationResponseDTO, DeleteOrganizationMembershipResponseDTO, DeleteOrganizationResponseDTO } from '@gefakit/shared/src/types/organization';
import { Kysely } from 'kysely';
import { DB } from '../../db/db-types';
import { createOrganizationService, OrganizationService } from './organization.service';
import { createOrganizationRepository } from './organization.repository';
import { createEmailService, EmailService } from '../emails/email.service';
import { createAppError } from '../../errors';
import { createOrganizationMembershipService, OrganizationMembershipService } from '../organization-memberships/organization-membership.service';
import { createOrganizationMembershipRepository } from '../organization-memberships/organization-membership.repository';
import { createOrganizationInvitationRepository } from '../organization-invitations/organization-invitation.repository';
import { createOrganizationInvitationService, OrganizationInvitationService } from '../organization-invitations/organization-invitation.service';
import { randomUUID } from 'node:crypto';
import { createAuthService } from '../auth/auth.service';
import { createAuthRepository } from '../auth/auth.repository';

type OrganizationRouteVariables = DbMiddleWareVariables & AuthMiddleWareVariables & {
  organizationService: OrganizationService,
  organizationMembershipService: OrganizationMembershipService,
  organizationInvitationService: OrganizationInvitationService,
  emailService: EmailService
}
const app = new Hono<{ Bindings: Bindings; Variables: OrganizationRouteVariables }>()

// Initialize services per-request
app.use('/*', async (c, next) => {
  const db = c.get("db") as Kysely<DB>;
  const organizationRepository = createOrganizationRepository({db});
  const organizationMembershipRepository = createOrganizationMembershipRepository({db});
  const organizationInvitationRepository = createOrganizationInvitationRepository({db});
  const authRepository = createAuthRepository({ db });

  const organizationService = createOrganizationService({db, organizationRepository, createOrganizationRepository});
  const organizationMembershipService = createOrganizationMembershipService({db, organizationMembershipRepository});
  const authService = createAuthService({ db, authRepository, createAuthRepository });
  const organizationInvitationService = createOrganizationInvitationService({db, organizationInvitationRepository, createOrganizationInvitationRepository, organizationService, authService});
  const emailService = createEmailService();

  c.set('organizationService', organizationService);
  c.set('organizationMembershipService', organizationMembershipService);
  c.set('organizationInvitationService', organizationInvitationService);
  c.set('emailService', emailService);
  await next();
});

// POST - create a new organization
app.post('/', zValidator('json', createOrganizationRequestBodySchema), async (c) => {
  const body = c.req.valid('json');
  const user = c.get('user');
  const organizationService = c.get('organizationService');

  const organization = await organizationService.createOrganization({data: body, userId: user.id});

  const response: CreateOrganizationResponseDTO = { createdOrganization: organization};
  return c.json(response, 201);
})

// DELETE - an organization
app.delete('/:orgId', async (c) => {
  const user = c.get('user');
  const orgId = c.req.param('orgId');
  const organizationService = c.get('organizationService');

  const organization = await organizationService.deleteOrganization({organizationId: parseInt(orgId), userId: user.id});

  const response: DeleteOrganizationResponseDTO = { deletedOrganization: organization};
  return c.json(response, 200);
})

// DELETE - current user's membership from a specific org
app.delete('/:orgId/memberships/me', async (c) => {
  const user = c.get('user');
  const orgId = c.req.param('orgId');
  const organizationMembershipService = c.get('organizationMembershipService');

  console.log('[orgRoutes] delete /:orgId/memberships/me', orgId, user.id);

  await organizationMembershipService.removeCurrentUserMembershipFromOrg({organizationId: parseInt(orgId), userId: user.id});
  const response = { success: true };

  return c.json(response, 200);
})

// DELETE - a specific organization membership
app.delete('/:orgId/memberships/:membershipId', async (c) => {
  const user = c.get('user');
  const orgId = c.req.param('orgId');
  const membershipId = c.req.param('membershipId');
  const organizationMembershipService = c.get('organizationMembershipService');

  await organizationMembershipService.removeUserMembershipFromOrg({organizationId: parseInt(orgId), userId: parseInt(membershipId)});
  const response = { success: true };

  return c.json(response, 200);
})

// POST - invite user by email to the organization
app.post('/:orgId/invitations', zValidator('json', createOrganizationInvitationRequestBodySchema), async (c) => {
  const user = c.get('user');
  const orgId = c.req.param('orgId');
  const body = c.req.valid('json');

  const organizationService = c.get('organizationService');
  const organizationInvitationService = c.get('organizationInvitationService');
  const emailService = c.get('emailService');

  // get the organization
  const organization = await organizationService.findOrganizationById({organizationId: parseInt(orgId)});

  if (!organization) {
    throw createAppError.organizations.organizationNotFound();
  }

  console.log('About to invite user by email', { orgId, userId: user.id, email: body.email });
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
  const user = c.get('user');
  const orgId = c.req.param('orgId');
  const organizationService = c.get('organizationService');

  // Assuming updateMembershipDefaultStatus is the correct service method
  await organizationService.updateMembershipDefaultStatus({userId: user.id, organizationId: parseInt(orgId)});

  const response = { success: true};
  return c.json(response, 200);
})

// --- Other routes will go here ---
// GET /
// GET /:orgId
// DELETE /:orgId
// POST /:orgId/activate
// POST /:orgId/set-default
// POST /:orgId/invitations
// DELETE /:orgId/invitations/:invitationId
// DELETE /:orgId/members/:userId
// PATCH /:orgId/members/:userId/role
// POST /invitations/:token/accept
// POST /invitations/:token/decline

export const organizationsRoutesV1 = app 