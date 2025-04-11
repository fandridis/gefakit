import { Hono } from "hono";

const app = new Hono<{ Bindings: Cloudflare.Env }>();

app.get("/message", (c) => {

  const x = c.env.DB_ENV;
  const xFromProcess = process.env.DB_ENV;
  
  return c.json({
    x,
    xFromProcess,
  });
});

export default app;
