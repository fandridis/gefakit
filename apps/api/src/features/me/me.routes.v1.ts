import { Hono } from 'hono'
import { Bindings } from '../../types/hono'
import { DbMiddleWareVariables } from '../../middleware/db'
import { AuthMiddleWareVariables } from '../../middleware/auth'
import { createOrganizationController } from '../organizations/organizations.controller'; // Will need later
import { createTodoController } from '../todos/todo.controller';
import { DeleteOrganizationMembershipResponseDTO } from '@gefakit/shared/src/types/organization';

type OrganizationRouteVariables = DbMiddleWareVariables & AuthMiddleWareVariables
const app = new Hono<{ Bindings: Bindings; Variables: OrganizationRouteVariables }>()

app.get('/organization-memberships', async (c) => {
  const db = c.get('db')
  const user = c.get('user');

  const controller = createOrganizationController(db);
  const result = await controller.findAllOrganizationMembershipsByUserId(user.id);

  return c.json(result, 200);
})

app.delete('/organizations/:orgId/membership', async (c) => {
  const db = c.get('db')
  const user = c.get('user');
  const orgId = c.req.param('orgId');

  const controller = createOrganizationController(db);
  await controller.deleteOrganizationMembership(parseInt(orgId), user.id);

  const response: DeleteOrganizationMembershipResponseDTO = { success: true};
  return c.json(response, 200);
})


app.get('/todos', async (c) => {
    const db = c.get("db");
    const user = c.get('user');

    const todoController = createTodoController(db);
    const result = await todoController.getTodos(user.id);

    const response: { todos: any[] } = { todos: result.todos };
    return c.json(response);
});

export const meRoutesV1 = app 