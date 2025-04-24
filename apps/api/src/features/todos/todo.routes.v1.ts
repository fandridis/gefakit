import { Hono } from "hono";
import { Bindings } from "../../types/hono";
import { zValidator } from "../../lib/zod-utils";
import { createTodoService, TodoService } from "./todo.service";
import { createTodoRepository } from "./todo.repository";
import { DbMiddleWareVariables } from "../../middleware/db";
import { AuthMiddleWareVariables } from "../../middleware/auth";
import {
  createTodoRequestBodySchema,
  updateTodoRequestBodySchema,
} from "@gefakit/shared/src/schemas/todo.schema";
import { Selectable } from "kysely";
import { CoreTodo } from "../../db/db-types";

type TodoRouteVars = DbMiddleWareVariables & AuthMiddleWareVariables & {
    todoService: TodoService;
  };

const app = new Hono<{ Bindings: Bindings; Variables: TodoRouteVars }>();

// Initialize service per-request
app.use("/*", async (c, next) => {
  const db = c.get("db");
  const todoRepository = createTodoRepository({ db });
  const todoService = createTodoService({ todoRepository });
  c.set("todoService", todoService);
  await next();
});

// GET /api/v1/todos - Get all todos for the current user
app.get("/", async (c) => {
    const user = c.get('user');
    const todoService = c.get('todoService');

    const result = await todoService.findAllTodosByAuthorId({authorId: user.id});

    // Ensure Selectable and CoreTodo are imported
    const response: { todos: Selectable<CoreTodo>[] } = { todos: result }; 
    return c.json(response);
});

// POST /api/v1/todos - Create a new todo
app.post(
  "/",
  zValidator("json", createTodoRequestBodySchema),
  async (c) => {
    const user = c.get("user");
    const data = c.req.valid("json");
    const todoService = c.get("todoService");
    const created = await todoService.createTodo({authorId: user.id, todo: {
       ...data, 
       author_id: user.id,
       completed: data.completed ?? false,
       due_date: data.due_date ?? null,
       description: data.description ?? null,
       
    }});
    return c.json({ createdTodo: created });
  }
);

// PUT /api/v1/todos/:id - Update a todo
app.put(
  "/:id",
  zValidator("json", updateTodoRequestBodySchema),
  async (c) => {
    const user = c.get("user");
    const id = Number(c.req.param("id"));
    const data = c.req.valid("json");
    const todoService = c.get("todoService");
    const updated = await todoService.updateTodo({id, authorId: user.id, todo: { 
      ...data, 
      author_id: user.id,
      completed: data.completed ?? false,
      due_date: data.due_date ?? null,
      description: data.description ?? null,
      
    }});
    return c.json({ updatedTodo: updated });
  }
);

// DELETE /api/v1/todos/:id - Delete a todo
app.delete("/:id", async (c) => {
  const user = c.get("user");
  const id = Number(c.req.param("id"));
  const todoService = c.get("todoService");
  const deleted = await todoService.deleteTodo({id, authorId: user.id});
  return c.json({ deletedTodo: deleted });
});

export const todoRoutesV1 = app;