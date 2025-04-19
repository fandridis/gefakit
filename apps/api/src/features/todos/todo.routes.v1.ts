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

// GET /api/v1/todos
app.get("/", async (c) => {
  const user = c.get("user");
  const todoService = c.get("todoService");
  const todos = await todoService.findAllTodosByAuthorId(user.id);
  return c.json({ todos } as { todos: Selectable<CoreTodo>[] });
});

// POST /api/v1/todos
app.post(
  "/",
  zValidator("json", createTodoRequestBodySchema),
  async (c) => {
    const user = c.get("user");
    const data = c.req.valid("json");
    const todoService = c.get("todoService");
    const created = await todoService.createTodo(user.id, { ...data, author_id: user.id });
    return c.json({ createdTodo: created });
  }
);

// PUT /api/v1/todos/:id
app.put(
  "/:id",
  zValidator("json", updateTodoRequestBodySchema),
  async (c) => {
    const user = c.get("user");
    const id = Number(c.req.param("id"));
    const data = c.req.valid("json");
    const todoService = c.get("todoService");
    const updated = await todoService.updateTodo(id, data, user.id);
    return c.json({ updatedTodo: updated });
  }
);

// DELETE /api/v1/todos/:id
app.delete("/:id", async (c) => {
  const user = c.get("user");
  const id = Number(c.req.param("id"));
  const todoService = c.get("todoService");
  const deleted = await todoService.deleteTodo(id, user.id);
  return c.json({ deletedTodo: deleted });
});

export const todoRoutesV1 = app;