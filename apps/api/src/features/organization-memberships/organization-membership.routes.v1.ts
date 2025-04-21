import { Hono } from 'hono'
import { Bindings } from '../../types/hono'
import { DbMiddleWareVariables } from '../../middleware/db'
import { AuthMiddleWareVariables } from '../../middleware/auth'
import { Kysely } from 'kysely';
import { DB } from '../../db/db-types';
import { createOrganizationMembershipService, OrganizationMembershipService } from './organization-membership.service';
import { createOrganizationMembershipRepository } from './organization-membership.repository';

type OrganizationMembershipRouteVariables = DbMiddleWareVariables & AuthMiddleWareVariables & {
  organizationMembershipService: OrganizationMembershipService,
}
const app = new Hono<{ Bindings: Bindings; Variables: OrganizationMembershipRouteVariables }>()

// Initialize services per-request
app.use('/*', async (c, next) => {
  const db = c.get("db") as Kysely<DB>;
  const organizationMembershipRepository = createOrganizationMembershipRepository({ db });
  const organizationMembershipService = createOrganizationMembershipService({ db, organizationMembershipRepository });

  c.set('organizationMembershipService', organizationMembershipService);
  await next();
});

// GET /api/v1/organization-memberships - Get all organization memberships for the current user
app.get('/', async (c) => {
  const user = c.get('user');
  const service = c.get('organizationMembershipService');

  const memberships = await service.findAllOrganizationMembershipsByUserId({userId: user.id});

  const response = { memberships };
  return c.json(response, 200);
})

export const organizationMembershipRoutesV1 = app 