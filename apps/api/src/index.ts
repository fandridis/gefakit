import { Hono } from "hono";
import { Bindings } from "./types/hono";
import { dbMiddleware } from "./middleware/db";
import { personRoutesV1 } from "./features/persons/person.routes.v1";
import { authRoutesV1 } from "./features/auth/auth.routes.v1";
import { ZodError } from "zod";
import { AppError } from "./errors/app-error";
import { todoRoutesV1 } from "./features/todos/todo.routes.v1";
import { authMiddleware } from "./middleware/auth";
import { organizationsRoutesV1 } from "./features/organizations/organizations.routes.v1";
import { myRoutesV1 } from "./features/my/my.routes.v1";
const app = new Hono<{ Bindings: Bindings}>();

app.use('/api/*', async (c, next) => {
  c.header('Access-Control-Allow-Origin', 'http://localhost:5173'); // Replace with your frontend domain
  c.header('Access-Control-Allow-Credentials', 'true');
  c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS'); 
  if (c.req.method === 'OPTIONS') {
    // Return OK status for preflight requests
    return c.text('OK', 200); 
  }
  await next();
});

// All routes will have access to the db instance.
app.use('/api/*', dbMiddleware);

// Current authenticated user specific routes
app.use("/api/v1/my/*", authMiddleware);
app.route("/api/v1/my", myRoutesV1);


app.route("/api/v1/persons", personRoutesV1);
app.route("/api/v1/auth", authRoutesV1);

// Apply auth middleware ONLY to todo routes
app.use("/api/v1/todos/*", authMiddleware); 
app.route("/api/v1/todos", todoRoutesV1);

// Apply auth middleware to organization routes
app.use("/api/v1/organizations/*", authMiddleware);
app.route("/api/v1/organizations", organizationsRoutesV1);

app.notFound((c) => {
  return c.text('This route does not exist', 404);
});

app.onError((err, c) => {
  console.log('===================== onError =====================');
  console.log('===================== onError =====================');
  console.log('===================== onError =====================');
  console.log('===================== onError =====================');
  console.log('===================== onError =====================');
  console.log('===================== onError =====================');
  console.log('===================== onError =====================');
  console.log('===================== onError =====================');
   console.error('App Error:', err);
  
  
  if (err instanceof ZodError) {
    console.log('IT IS A ZOD ERROR (direct)');
    return c.json({
      ok: false,
      errors: err.errors.map(e => ({
        field: e.path.join('.'),
        message: e.message
      }))
    }, 400);
  }

  // Check if the error is an HTTPException with a ZodError cause
  // Note: We might need to import HTTPException from 'hono/http-exception'
  //       or just check for the presence and type of the 'cause' property.
  //       Let's try checking the property first for simplicity.
  if (err instanceof Error && err.cause instanceof ZodError) {
    console.log('IT IS A ZOD ERROR (wrapped in HTTPException)');
    const zodError = err.cause;
    return c.json({
      ok: false,
      errors: zodError.errors.map(e => ({
        field: e.path.join('.'),
        message: e.message
      }))
    }, 400); // Use 400 for validation errors
  }

  console.log('it is not a zod error');

  if (err instanceof AppError) {
    const statusCode = typeof err.status === 'number' && err.status >= 100 && err.status <= 599 
      ? err.status 
      : 500;
    return c.json({ 
      ok: false, 
      errorMessage: err.message,
      errorDetails: err.details 
    }, statusCode as any);
  }

  return c.json({ ok: false, error: "Internal Server Error" }, 500);
});

export default app;
