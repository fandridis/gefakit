import { Hono } from 'hono'
import { Bindings } from '../../types/hono'
import { DbMiddleWareVariables } from '../../middleware/db'
import { AuthMiddleWareVariables } from '../../middleware/auth'
import { zValidator } from '../../lib/zod-utils';
import { createOrganizationRequestBodySchema } from '@gefakit/shared/src/schemas/organization.schema';
import { CreateOrganizationResponseDTO, DeleteOrganizationResponseDTO } from '@gefakit/shared/src/types/organization';
import { Kysely } from 'kysely';
import { DB } from '../../db/db-types';
import { createOrganizationService, OrganizationService } from './organizations.service';
import { createEmailService } from '../emails/email.service';
import { createAuthService } from '../auth/auth.service';
import { createOrganizationRepository } from './organizations.repository';
import { createAuthRepository } from '../auth/auth.repository';

type OrganizationRouteVariables = DbMiddleWareVariables & AuthMiddleWareVariables & {
  organizationService: OrganizationService
}
const app = new Hono<{ Bindings: Bindings; Variables: OrganizationRouteVariables }>()

app.use('/*', async (c, next) => {
  const db = c.get("db") as Kysely<DB>;
  const organizationRepository = createOrganizationRepository({db});
  const organizationService = createOrganizationService({db, organizationRepository});
  c.set('organizationService', organizationService);
  await next();
});

app.post('/', zValidator('json', createOrganizationRequestBodySchema), async (c) => {
  const body = c.req.valid('json');
  const user = c.get('user');
  const service = c.get('organizationService');

  const organization = await service.createOrganization(body, user.id);

  const response: CreateOrganizationResponseDTO = { createdOrganization: organization};
  return c.json(response, 201);
})

app.delete('/:orgId', async (c) => {
  const user = c.get('user');
  const orgId = c.req.param('orgId');
  const service = c.get('organizationService');

  const organization = await service.deleteOrganization(parseInt(orgId), user.id);

  const response: DeleteOrganizationResponseDTO = { deletedOrganization: organization};
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