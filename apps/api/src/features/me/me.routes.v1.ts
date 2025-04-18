import { Hono } from 'hono'
import { Bindings } from '../../types/hono'
import { DbMiddleWareVariables } from '../../middleware/db'
import { AuthMiddleWareVariables } from '../../middleware/auth'
import { createOrganizationController, OrganizationController } from '../organizations/organizations.controller'; // Will need later
import { createTodoController, TodoController } from '../todos/todo.controller';
import { DeleteOrganizationMembershipResponseDTO } from '@gefakit/shared/src/types/organization';
import { createTodoService } from '../todos/todo.service'; // Import service
import { createTodoRepository } from '../todos/todo.repository'; // Import repository
import { CoreTodo } from '../../db/db-types'; // Import CoreTodo type
import { Selectable } from 'kysely'; // Import Selectable
import { createAuthRepository } from '../auth/auth.repository';
import { createOrganizationRepository } from '../organizations/organizations.repository';
import { createOrganizationService } from '../organizations/organizations.service';
import { createAuthService } from '../auth/auth.service';
import { createEmailService } from '../emails/email.service';

type OrganizationRouteVariables = DbMiddleWareVariables & AuthMiddleWareVariables & {
  organizationController: OrganizationController
  todoController: TodoController
}
const app = new Hono<{ Bindings: Bindings; Variables: OrganizationRouteVariables }>()

app.use('/*', async (c, next) => {
  const db = c.get('db');
  const organizationRepository = createOrganizationRepository({db});
  const organizationService = createOrganizationService({db, organizationRepository});
  const emailService = createEmailService({db});
  const authRepository = createAuthRepository({db});
  const authService = createAuthService({db, authRepository});
  const organizationController = createOrganizationController({organizationService, emailService, authService});
  const todoRepository = createTodoRepository({db});
  const todoService = createTodoService({todoRepository});
  const todoController = createTodoController({todoService});

  c.set('organizationController', organizationController);
  c.set('todoController', todoController);
  await next();
});

app.get('/organization-memberships', async (c) => {
  const db = c.get('db')
  const user = c.get('user');
  const organizationController = c.get('organizationController');

  const result = await organizationController.findAllOrganizationMembershipsByUserId(user.id);

  return c.json(result, 200);
})

app.delete('/organizations/:orgId/membership', async (c) => {
  const user = c.get('user');
  const orgId = c.req.param('orgId');
  const organizationController = c.get('organizationController');

  await organizationController.deleteOrganizationMembership(parseInt(orgId), user.id);

  const response: DeleteOrganizationMembershipResponseDTO = { success: true};
  return c.json(response, 200);
})


app.get('/todos', async (c) => {
    const user = c.get('user');
    const todoController = c.get('todoController');

    const result = await todoController.getTodos(user.id);

    const response: { todos: Selectable<CoreTodo>[] } = { todos: result.todos };
    return c.json(response);
});

export const meRoutesV1 = app 