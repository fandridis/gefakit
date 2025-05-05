import { Hono } from 'hono'
import { Bindings } from '../../types/hono'
import { getOrganizationInvitationService } from '../../utils/get-service';
import { AppVariables } from '../../create-app';
import { getAuthOrThrow } from '../../utils/get-auth-or-throw';

const app = new Hono<{ Bindings: Bindings; Variables: AppVariables }>()

// GET - all organization invitations for the current user
app.get('/', async (c) => {
  const { user } = getAuthOrThrow(c);
  const invitationService = getOrganizationInvitationService(c);

  const invitations = await invitationService.findAllInvitationsByUserId({userId: user.id});

  const response = { invitations };
  return c.json(response, 201);
})

// POST - accept an organization invitation
app.post('/:token/accept', async (c) => {
  const token = c.req.param('token');
  const { user } = getAuthOrThrow(c);
  const invitationService = getOrganizationInvitationService(c);

  const invitation = await invitationService.acceptInvitation({token, acceptingUserId: user.id});

  const response = { invitation };
  return c.json(response, 201);
})

// POST - decline an organization invitation
app.post('/:token/decline', async (c) => {
  const token = c.req.param('token');
  const invitationService = getOrganizationInvitationService(c);

  const invitation = await invitationService.declineInvitation({token});

  const response = { invitation };
  return c.json(response, 201);
})

export const organizationInvitationRoutesV1 = app 