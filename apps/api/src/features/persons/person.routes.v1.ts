import { Hono } from "hono";
import { Bindings } from "../../types/hono";
import { Variables } from "../../types/hono";


const app = new Hono<{ Bindings: Bindings, Variables: Variables }>();

app.get("/", async (c) => {
    const db = c.get("db");
   
     const authors = await db.selectFrom("person").selectAll().execute();


    return c.json({ authors });
});

app.post('/', async (c) => {
    const db = c.get("db");
    const authors = await db.insertInto('person').values({
      //  id: 1,
        first_name: "John 1",
        last_name: "Doe 1",
        gender: "male",
    }).execute();
    return c.json({ authors });
})

app.get('/:id', async (c) => {
    const id = c.req.param('id')

    console.log('id: ', id);
    const KV = c.env.KV;
    const kv = await KV.get('myKey');

    return c.json({ id, kv });
  })

export const authorRoutesV1 = app;