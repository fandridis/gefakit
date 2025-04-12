import { Hono } from "hono";
import { Variables } from "./types/hono";
import { Bindings } from "./types/hono";
import { dbMiddleware } from "./middleware/db";
import { authorRoutesV1 } from "./features/authors/author.routes.v1";

const app = new Hono<{ Bindings: Bindings, Variables: Variables }>();

/**
 * All routes will have have access to the db instance.
 */
app.use(dbMiddleware);

app.get("/api", (c) => {
    return c.text("Hello World");
});

app.route("/api/v1/authors", authorRoutesV1);



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
  console.error('error: ', err);
  return c.text('Internal Server Error...', 500);
});

export default app;
