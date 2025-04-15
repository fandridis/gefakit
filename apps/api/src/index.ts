import { Hono } from "hono";
import { Variables } from "./types/hono";
import { Bindings } from "./types/hono";
import { dbMiddleware } from "./middleware/db";
import { personRoutesV1 } from "./features/persons/person.routes.v1";
import { authRoutesV1 } from "./features/auth/auth.routes.v1";
import { ZodError } from "zod";
import { AppError } from "./errors/app-error";

const app = new Hono<{ Bindings: Bindings, Variables: Variables }>();


// app.use('/api/*', cors({
//   origin: ['http://localhost:5173', 'http://localhost:5174'],
//   credentials: true,
// }))


app.use('/api/*', async (c, next) => {
  c.header('Access-Control-Allow-Origin', 'http://localhost:5173'); // Replace with your frontend domain
  c.header('Access-Control-Allow-Credentials', 'true');
  c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (c.req.method === 'OPTIONS') {
    return c.text('OK', 200);
  }
  await next();
});

/**
 * All routes will have have access to the db instance.
 */

app.use(dbMiddleware);

// app.on(["POST", "GET"], "/api/auth/**", async (c) => {
//   devlog('auth.handler')
//   const res = await auth.handler(c.req.raw)

//   console.log('res: ', res)
//   return res
// });


app.route("/api/v1/persons", personRoutesV1);
app.route("/api/v1/auth", authRoutesV1);


app.get('/user-agent', (c) => {
  const userAgent = c.req.header('User-Agent')
  return c.text(`Your UserAgent is ${userAgent}`)
})

app.notFound((c) => {
  return c.text('This route does not exist', 404);
});

app.get('/error', () => {
  throw new Error('This is a test error'); // This will trigger the onError handler which will log the error here.
});

app.onError((err, c) => {
  console.error('App Error:', err);

  if (err instanceof ZodError) {
    return c.json({
      ok: false,
      errors: err.errors.map(e => ({
        field: e.path.join('.'),
        message: e.message
      }))
    }, 400);
  }

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

function devlog(message: string) {
  console.log('===============================================')
  console.log('.')
  console.log('.')
  console.log(message)
  console.log('.')
  console.log('.')
  console.log('===============================================')
}