import { Hono } from 'hono'
import { Bindings } from '../../types/hono'
import { getOrganizationMembershipService } from '../../utils/get-service';
import { AppVariables } from '../../create-app';
import { getAuthOrThrow } from '../../utils/get-auth-or-throw';

export function createOrganizationMembershipRoutesV1() {
  const app = new Hono<{ Bindings: Bindings; Variables: AppVariables }>()

  // GET /api/v1/organization-memberships - Get all organization memberships for the current user
  app.get('/', async (c) => {
    const { user } = getAuthOrThrow(c);
    const service = getOrganizationMembershipService(c);

    const memberships = await service.findAllOrganizationMembershipsByUserId({ userId: user.id });

    const response = { memberships };
    return c.json(response, 200);
  })

  return app;
} 