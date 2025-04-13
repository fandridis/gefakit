import { Hono } from "hono";
import { jsonArrayFrom } from 'kysely/helpers/postgres'
import { Bindings } from "../../types/hono";
import { Variables } from "../../types/hono";


const app = new Hono<{ Bindings: Bindings, Variables: Variables }>();

app.get("/", async (c) => {
    const db = c.get("db");
   
     const persons = await db
      .selectFrom("person")
      .selectAll()
      .select((eb) => [
        // pets
        jsonArrayFrom(
          eb.selectFrom('pet')
            .select(['pet.id', 'pet.name'])
            .whereRef('pet.owner_id', '=', 'person.id')
            .orderBy('pet.name')
        ).as('pets')
      ])
      .execute();

    return c.json({ persons });
});

app.post('/', async (c) => {
    const db = c.get("db");
    const persons = await db.insertInto('person').values({
      //  id: 1,
        first_name: "John 1",
        last_name: "Doe 1",
        gender: "male",
    }).execute();
    return c.json({ persons });
})

app.get('/:id', async (c) => {
    const id = c.req.param('id')

    console.log('id: ', id);
    const KV = c.env.KV;
    const kv = await KV.get('myKey');

    return c.json({ id, kv });
  })

export const authorRoutesV1 = app;