import { Hono } from "hono";
import { Bindings } from "../../types/hono";
import { Variables } from "../../types/hono";
import { jsonArrayFrom } from "kysely/helpers/sqlite";


const app = new Hono<{ Bindings: Bindings, Variables: Variables }>();

app.get("/", async (c) => {
    const db = c.get("db");
   //  const authors = await db.selectFrom("authors").selectAll().execute();

   const authors = await db
    .selectFrom("authors")
    .selectAll('authors')
    .select((eb) => [
        jsonArrayFrom(
            eb.selectFrom('posts')
            .select(['posts.id', 'posts.title', 'posts.content'])
            .whereRef('posts.author_id', '=', 'authors.id')
            .orderBy('posts.title', 'desc')
        ).as('posts')
    ])
    .execute()

    console.log('authors: ', authors[0].posts);

    return c.json({ authors });
});

app.post('/', async (c) => {
    const db = c.get("db");
    const authors = await db.insertInto("authors").values({
      //  id: 1,
        username: "John Doe",
        email: "john.doe@example.com", 
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