import { Hono } from "hono";
import { Bindings } from "../../types/hono";
import { zValidator } from "../../lib/zod-utils";
import { AuthMiddleWareVariables } from "../../middleware/auth";
import {
  createTodoRequestBodySchema,
  updateTodoRequestBodySchema,
} from "@gefakit/shared/src/schemas/todo.schema";
import { Selectable } from "kysely";
import { CoreTodo } from "../../db/db-types";
import { getTodoService } from "../../core/services";
import { CoreAppVariables } from "../../create-app";
import { TodoService } from "./todo.service";

// We set the types of the app variables until this point.
type TodoRouteVars = CoreAppVariables & AuthMiddleWareVariables

export function createTodoRoutesV1() {
  const app = new Hono<{ Bindings: Bindings; Variables: TodoRouteVars }>();

  // // Initialize service per-request ONLY IF it hasn't been set by global middleware
  // app.use("/*", async (c, next) => {
  //   if (!c.get("todoService")) {
  //     console.log("TodoService not found in context, creating fallback instance.");
  //     const db = c.get("db"); 
  //     if (!db) { // This should never happen as db is always set by global middleware.
  //          console.error("DB not found in context in todo middleware!");
  //          return c.json({ ok: false, error: "Internal configuration error: DB missing." }, 500);
  //     }
  //     const todoService = getTodoService(db);
  //     c.set("todoService", todoService); 
  //   } 
  //   await next(); // Proceed to the route handlers or next middleware
  // });

  // GET /api/v1/todos - Get all todos for the current user
  app.get("/", async (c) => {
    const user = c.get('user');
    
    // Initialize service per-request ONLY IF it hasn't been set by global middleware
    const todoService = c.get('todoService') ?? getTodoService(c.get('db'));


    if (!todoService) {
      // This should theoretically not happen due to the fallback, but good practice to check.
      console.error("Failed to initialize TodoService.");
      return c.json({ ok: false, error: "Internal server error: Service unavailable." }, 500);
    }

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
      // Initialize service per-request ONLY IF it hasn't been set by global middleware
      const todoService = c.get('todoService') ?? getTodoService(c.get('db'));
      
      if (!todoService) {
        console.error("Failed to initialize TodoService in POST /todos.");
        return c.json({ ok: false, error: "Internal server error: Service unavailable." }, 500);
      }
      
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
      // Initialize service per-request ONLY IF it hasn't been set by global middleware
      const todoService = c.get("todoService") ?? getTodoService(c.get('db'));
      
      if (!todoService) {
        console.error("Failed to initialize TodoService in PUT /todos/:id.");
        return c.json({ ok: false, error: "Internal server error: Service unavailable." }, 500);
      }
      
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
    // Initialize service per-request ONLY IF it hasn't been set by global middleware
    const todoService = c.get("todoService") ?? getTodoService(c.get('db'));
    
    if (!todoService) {
      console.error("Failed to initialize TodoService in DELETE /todos/:id.");
      return c.json({ ok: false, error: "Internal server error: Service unavailable." }, 500);
    }
    
    const deleted = await todoService.deleteTodo({id, authorId: user.id});
    return c.json({ deletedTodo: deleted });
  });

  return app;
}
