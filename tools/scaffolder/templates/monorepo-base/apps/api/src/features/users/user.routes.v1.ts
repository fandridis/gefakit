/**
 * Not using this route anymore.
 * Using the todo routes instead.
 * 
 * But keeping it here for reference of resolving the :id param to the user's ID
 */

import { Hono, Context, Next } from "hono";
import { Bindings } from "../../types/hono";
import { DbMiddleWareVariables } from "../../middleware/db";
import { AuthMiddleWareVariables } from "../../middleware/auth";
import { createTodoService, TodoService } from "../todos/todo.service";
import { createTodoRepository } from "../todos/todo.repository";

// Define combined variables including the one added by our middleware
type UserRouteVars = DbMiddleWareVariables & AuthMiddleWareVariables & {
    resolvedUserId: number; // This will hold the actual user ID (even if 'me' was used)
    todoService: TodoService;
};

// Define context type for handlers after the middleware has run
type UserAppContext = Context<{ Bindings: Bindings; Variables: UserRouteVars }>;



// Create the Hono app instance for user routes
// Specify the final Variable shape including 'resolvedUserId'
const userApp = new Hono<{ Bindings: Bindings; Variables: UserRouteVars }>();

/**
 * Middleware to resolve ':id' parameter if it's 'me'.
 * It checks if the :id param is literally "me". If so, it retrieves the
 * authenticated user's ID and stores it in `c.var.resolvedUserId`.
 * Otherwise, it stores the original :id param value in `c.var.resolvedUserId`.
 * This allows downstream handlers to uniformly use `c.get('resolvedUserId')`.
 */
const resolveMeParamMiddleware = async (c: UserAppContext, next: Next) => {
    const id = c.req.param('id');
    const finalId = id === 'me' ? c.get('user')?.id : parseInt(id);
    c.set('resolvedUserId', finalId);
    await next();
};

// middleware to initialize todoService
userApp.use('/:id/*', async (c, next) => {
    const db = c.get('db');
    const todoRepository = createTodoRepository({ db });
    const todoService = createTodoService({ todoRepository });
    c.set('todoService', todoService);
    await next();
});


// Catches all routes that start with /:id and resolves the :id param to the user's ID
userApp.use('/:id/*', resolveMeParamMiddleware);


// GET /api/v1/users/:id/profile - Handles both actual IDs and 'me'
userApp.get("/:id/todos", async (c: UserAppContext) => {
    const userId = c.get('resolvedUserId'); // Use the resolved ID
    
    const todoService = c.get('todoService');
    const todos = await todoService.findAllTodosByAuthorId({authorId: userId});

    const response = { todos: todos }

    return c.json(response);
});

// Add other /users/:id/* routes here using the same pattern:
// userApp.get("/:id/settings", async (c: UserAppContext) => {
//    const userId = c.get('resolvedUserId');
//    const settings = await getUserSettings(userId, c); // Assuming getUserSettings exists
//    return c.json(settings);
// });

// Export the userApp router instance
export const userRoutesV1 = userApp;