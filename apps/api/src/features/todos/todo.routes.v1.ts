import { Hono } from "hono";
import { Bindings } from "../../types/hono";
import { zValidator } from "../../lib/zod-utils";
import { createTodoController, TodoController } from "./todo.controller";
import { createTodoService } from "./todo.service";
import { createTodoRepository } from "./todo.repository";
import { DbMiddleWareVariables } from "../../middleware/db";
import { AuthMiddleWareVariables } from "../../middleware/auth";
import { createTodoRequestBodySchema, updateTodoRequestBodySchema } from "@gefakit/shared/src/schemas/todo.schema";
import { CreateTodoResponseDTO, DeleteTodoResponseDTO, UpdateTodoResponseDTO } from "@gefakit/shared/src/types/todo";
import { Selectable } from 'kysely';
import { CoreTodo } from '../../db/db-types';

type TodoRouteVariables = DbMiddleWareVariables & AuthMiddleWareVariables & {
    todoController: TodoController
};
const app = new Hono<{ Bindings: Bindings, Variables: TodoRouteVariables }>();

app.use('/*', async (c, next) => {
    const db = c.get("db");
    const todoRepository = createTodoRepository({db});
    const todoService = createTodoService({todoRepository});
    const todoController = createTodoController({todoService});
    c.set('todoController', todoController);
    await next();
});

app.get('/', async (c) => {
    const user = c.get('user');
    const todoController = c.get('todoController');

    const result = await todoController.getTodos(user.id);

    console.log('todoController', todoController);

    const response: { todos: Selectable<CoreTodo>[] } = { todos: result.todos };
    return c.json(response);
});

app.post('/', zValidator('json', createTodoRequestBodySchema), async (c) => {
    const user = c.get('user');
    const todoToCreate = c.req.valid('json');
    const todoController = c.get('todoController');

    const result = await todoController.createTodo(user.id, { ...todoToCreate, author_id: user.id });

    const response: CreateTodoResponseDTO = { createdTodo: result.todo };
    return c.json(response, 201);
});

app.put('/:id', zValidator('json', updateTodoRequestBodySchema), async (c) => {
    const todoId = c.req.param('id');
    const user = c.get('user');
    const todoToUpdate = c.req.valid('json');
    const todoController = c.get('todoController');

    const result = await todoController.updateTodo(parseInt(todoId), todoToUpdate, user.id);

    const response: UpdateTodoResponseDTO = { updatedTodo: result.todo };
    return c.json(response, 200);
});

app.delete('/:id', async (c) => {
    console.log('===================== deleteTodo =====================');
    const todoId = c.req.param('id');
    const user = c.get('user');
    const todoController = c.get('todoController');

    const result = await todoController.deleteTodo(parseInt(todoId), user.id);

    const response: DeleteTodoResponseDTO = { deletedTodo: result.todo };
    return c.json(response, 200);
});

export const todoRoutesV1 = app;
