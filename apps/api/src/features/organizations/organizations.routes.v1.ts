import { Hono } from 'hono'
import { Bindings } from '../../types/hono'
import { DbMiddleWareVariables } from '../../middleware/db'
import { AuthMiddleWareVariables } from '../../middleware/auth'
import { zValidator } from '../../lib/zod-utils';
import { createOrganizationController } from './organizations.controller';
import { createOrganizationRequestBodySchema } from '@gefakit/shared/src/schemas/organization.schema';
import { CreateOrganizationResponseDTO, DeleteOrganizationResponseDTO } from '@gefakit/shared/src/types/organization';

type OrganizationRouteVariables = DbMiddleWareVariables & AuthMiddleWareVariables
const app = new Hono<{ Bindings: Bindings; Variables: OrganizationRouteVariables }>()

app.post('/', zValidator('json', createOrganizationRequestBodySchema), async (c) => {
  const db = c.get('db')
  const body = c.req.valid('json');
  const user = c.get('user');

  const controller = createOrganizationController(db);
  const result = await controller.createOrganization(body, user.id);

  const response: CreateOrganizationResponseDTO = { createdOrganization: result.organization};
  return c.json(response, 201);
})

app.delete('/:orgId', async (c) => {
  console.log('=============== HERE ===============')
  const db = c.get('db')
  const user = c.get('user');
  const orgId = c.req.param('orgId');

  const controller = createOrganizationController(db);
  const result = await controller.deleteOrganization(parseInt(orgId), user.id);

  const response: DeleteOrganizationResponseDTO = { deletedOrganization: result.organization};
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