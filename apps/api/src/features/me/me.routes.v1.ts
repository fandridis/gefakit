import { Hono } from 'hono'
import { Bindings } from '../../types/hono'
import { DbMiddleWareVariables } from '../../middleware/db'
import { AuthMiddleWareVariables } from '../../middleware/auth'
import { DeleteOrganizationMembershipResponseDTO } from '@gefakit/shared/src/types/organization';
import { createTodoService, TodoService } from '../todos/todo.service'; // Import service
import { createTodoRepository } from '../todos/todo.repository'; // Import repository
import { CoreTodo } from '../../db/db-types'; // Import CoreTodo type
import { Selectable } from 'kysely'; // Import Selectable
import { createOrganizationRepository } from '../organizations/organizations.repository';
import { createOrganizationService, OrganizationService } from '../organizations/organizations.service';

type MeRouteVariables = DbMiddleWareVariables & AuthMiddleWareVariables & {
  organizationService: OrganizationService;
  todoService: TodoService;
}
const app = new Hono<{ Bindings: Bindings; Variables: MeRouteVariables }>()

app.use('/*', async (c, next) => {
  const db = c.get('db');
  const organizationRepository = createOrganizationRepository({db});
  const organizationService = createOrganizationService({db, organizationRepository});
  const todoRepository = createTodoRepository({db});
  const todoService = createTodoService({todoRepository});

  c.set('organizationService', organizationService);
  c.set('todoService', todoService);
  await next();
});

app.get('/organization-memberships', async (c) => {
  const user = c.get('user');
  const organizationService = c.get('organizationService');

  const result = await organizationService.findAllOrganizationMembershipsByUserId(user.id);

  console.log('result: ', result)
  const response = { memberships: result };

  return c.json(response, 200);
})

app.delete('/organizations/:orgId/membership', async (c) => {
  const user = c.get('user');
  const orgId = c.req.param('orgId');
  const organizationService = c.get('organizationService');

  await organizationService.deleteOrganizationMembership(parseInt(orgId), user.id);

  const response: DeleteOrganizationMembershipResponseDTO = { success: true};
  return c.json(response, 200);
})

// app.put('organizations/:orgId/default-organization', async (c) => {
//   // Update the default organization for the user
//   const user = c.get('user');
//   const orgId = c.req.param('orgId');
//   const organizationController = c.get('organizationController');

//   await organizationController.updateDefaultOrganization(user.id, parseInt(orgId));

//   const response: UpdateDefaultOrganizationResponseDTO = { success: true};
//   return c.json(response, 200);
// })

app.put('organizations/:orgId/active-organization', async (c) => {
  // Update the active organization for the user
  const user = c.get('user');
  const orgId = c.req.param('orgId');
  const organizationService = c.get('organizationService');

  await organizationService.updateMembershipDefaultStatus(user.id, parseInt(orgId));

  const response = { success: true};
  return c.json(response, 200);
  
})


app.get('/todos', async (c) => {
    const user = c.get('user');
    const todoService = c.get('todoService');

    const result = await todoService.findAllTodosByAuthorId(user.id);

    const response: { todos: Selectable<CoreTodo>[] } = { todos: result };
    return c.json(response);
});

export const meRoutesV1 = app 