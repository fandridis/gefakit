import { Hono } from "hono";
import { Bindings } from "../../types/hono";
import { zValidator } from "../../lib/zod-utils";
import { z } from "zod";
import { createAppError } from "../../errors";
import { createTodoController } from "./todo.controller";
import type { UserDTO, SessionDTO } from '@gefakit/shared/src/types/auth';
import { DbMiddleWareVariables } from "../../middleware/db";
import { AuthMiddleWareVariables } from "../../middleware/auth";
import { createTodoRequestBodySchema, updateTodoRequestBodySchema } from "@gefakit/shared/src/schemas/todo.schema";
import { CreateTodoResponseDTO, DeleteTodoResponseDTO, UpdateTodoResponseDTO } from "@gefakit/shared/src/types/todo";

type TodoRouteVariables = DbMiddleWareVariables & AuthMiddleWareVariables
const app = new Hono<{ Bindings: Bindings, Variables: TodoRouteVariables }>();

app.get('/', async (c) => {
    const db = c.get("db");
    const user = c.get('user');

    const todoController = createTodoController(db);
    const result = await todoController.getTodos(user.id);

    const response: { todos: any[] } = { todos: result.todos };
    return c.json(response);
});

app.post('/', zValidator('json', createTodoRequestBodySchema), async (c) => {
    const db = c.get("db");
    const user = c.get('user');
    const todoToCreate = c.req.valid('json');

    const todoController = createTodoController(db);
    const result = await todoController.createTodo(user.id, { ...todoToCreate, author_id: user.id }); 

    const response: CreateTodoResponseDTO = { createdTodo: result.todo };
    return c.json(response, 201); 
});

app.put('/:id', zValidator('json', updateTodoRequestBodySchema), async (c) => {
    const todoId = c.req.param('id');
    const db = c.get("db");
    const user = c.get('user');
    const todoToUpdate = c.req.valid('json');
    const todoController = createTodoController(db);

    const result = await todoController.updateTodo(parseInt(todoId), todoToUpdate, user.id);

    const response: UpdateTodoResponseDTO = { updatedTodo: result.todo };
    return c.json(response, 200);
});

app.delete('/:id', async (c) => {
    console.log('===================== deleteTodo =====================');
    const todoId = c.req.param('id');
    const db = c.get("db");
    const user = c.get('user');

    const todoController = createTodoController(db);
    const result = await todoController.deleteTodo(parseInt(todoId), user.id);

    const response: DeleteTodoResponseDTO = { deletedTodo: result.todo };
    return c.json(response, 200);
});

export const todoRoutesV1 = app;
