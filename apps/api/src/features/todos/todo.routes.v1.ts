import { Hono } from "hono";
import { Bindings } from "../../types/hono";
import { zValidator } from "../../lib/zod-validator";
import {
  createTodoRequestBodySchema,
  updateTodoRequestBodySchema,
} from "@gefakit/shared/src/schemas/todo.schema";
import { Selectable } from "kysely";
import { CoreTodo } from "../../db/db-types";
import { AppVariables } from "../../create-app";
import { getAuthOrThrow } from "../../utils/get-auth-or-throw";
import { getTodoService } from "../../utils/get-service";


export function createTodoRoutesV1() {
  const app = new Hono<{ Bindings: Bindings; Variables: AppVariables }>();

  // GET /api/v1/todos - Get all todos for the current user
  app.get("/", async (c) => {
    const { user } = getAuthOrThrow(c);
    const todoService = getTodoService(c);

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
      const { user } = getAuthOrThrow(c);
      const data = c.req.valid("json");
      const todoService = getTodoService(c);

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
      const { user } = getAuthOrThrow(c);
      const id = Number(c.req.param("id"));
      const data = c.req.valid("json");
      const todoService = getTodoService(c);

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
    const { user } = getAuthOrThrow(c);
    const id = Number(c.req.param("id"));
      const todoService = getTodoService(c);

    const deleted = await todoService.deleteTodo({id, authorId: user.id});
    return c.json({ deletedTodo: deleted });
  });

  return app;
}
