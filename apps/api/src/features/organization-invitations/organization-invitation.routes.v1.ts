import { Hono } from 'hono'
import { Bindings } from '../../types/hono'
import { DbMiddleWareVariables } from '../../middleware/db'
import { AuthMiddleWareVariables } from '../../middleware/auth'
import { Kysely } from 'kysely';
import { DB } from '../../db/db-types';
import { createOrganizationInvitationService, OrganizationInvitationService } from './organization-invitation.service';
import { createOrganizationInvitationRepository } from './organization-invitation.repository';
import { createOrganizationService, OrganizationService } from '../organizations/organization.service';
import { createOrganizationRepository } from '../organizations/organization.repository';
import { createAuthService } from '../auth/auth.service';
import { createAuthRepository } from '../auth/auth.repository';
type OrganizationInvitationRouteVariables = DbMiddleWareVariables & AuthMiddleWareVariables & {
  organizationInvitationService: OrganizationInvitationService,
  organizationService: OrganizationService,
}
const app = new Hono<{ Bindings: Bindings; Variables: OrganizationInvitationRouteVariables }>()

// Initialize services per-request
app.use('/*', async (c, next) => {
  const db = c.get("db") as Kysely<DB>;
  const organizationInvitationRepository = createOrganizationInvitationRepository({ db });
  const organizationRepository = createOrganizationRepository({ db });
  const authRepository = createAuthRepository({ db });
  const authService = createAuthService({db, authRepository, createAuthRepository, createOrganizationRepository});
  const organizationService = createOrganizationService({ db, organizationRepository, createOrganizationRepository });
  const organizationInvitationService = createOrganizationInvitationService({ db, organizationInvitationRepository, organizationService, createOrganizationInvitationRepository, authService });

  c.set('organizationInvitationService', organizationInvitationService);
  await next();
});

// GET - all organization invitations for the current user
app.get('/', async (c) => {
  const user = c.get('user');
  const service = c.get('organizationInvitationService');

  const invitations = await service.findAllInvitationsByUserId({userId: user.id});

  const response = { invitations };
  return c.json(response, 201);
})

// POST - accept an organization invitation
app.post('/:token/accept', async (c) => {
  console.log(`gefa1: with token ${c.req.param('token')} and user ${c.get('user').id}`);
  const token = c.req.param('token');
  const user = c.get('user');
  const service = c.get('organizationInvitationService');

  const invitation = await service.acceptInvitation({token, acceptingUserId: user.id});

  const response = { invitation };
  return c.json(response, 201);
})

// POST - decline an organization invitation
app.post('/:token/decline', async (c) => {
  const token = c.req.param('token');
  const service = c.get('organizationInvitationService');

  const invitation = await service.declineInvitation({token});
  console.log('[Route] Declined invitation', { invitation });

  const response = { invitation };
  return c.json(response, 201);
})



export const organizationInvitationRoutesV1 = app 