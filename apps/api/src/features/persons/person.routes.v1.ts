import { Hono } from "hono";
import { jsonArrayFrom } from 'kysely/helpers/postgres'
import { Bindings } from "../../types/hono";
import { Variables } from "../../types/hono";
import { getCookie } from "hono/cookie";
import { createAuthService } from "../auth/auth.service";
import { createAppError } from "../../errors";


const app = new Hono<{ Bindings: Bindings, Variables: Variables }>();

app.get("/", async (c) => {
    const db = c.get("db");

    const sessionToken = getCookie(c, 'gefakit-session');

    if (!sessionToken) {
        throw createAppError.auth.unauthorized();
    }

    console.log('sessionToken: ', sessionToken)
    
    const authService = createAuthService(db);
    const {session} = await authService.getCurrentSession(sessionToken);

    if (!session) {
        throw createAppError.auth.unauthorized();
    }
   
     const persons = await db
      .selectFrom('app_user')
      .selectAll()
      .execute();

    return c.json({ persons });
});


app.get('/:id', async (c) => {
    const id = c.req.param('id')

    console.log('id: ', id);
    const KV = c.env.KV;
    const kv = await KV.get('myKey');

    return c.json({ id, kv });
  })

export const personRoutesV1 = app;