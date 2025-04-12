import { createMiddleware } from 'hono/factory'
import { Kysely, ParseJSONResultsPlugin } from 'kysely'
import { D1Dialect } from 'kysely-d1'
import { Database } from '../db/types';

export const dbMiddleware = createMiddleware(async (c, next) => {
    const db = new Kysely<Database>({
      dialect: new D1Dialect({ database: c.env.DB }),
      plugins: [
        new ParseJSONResultsPlugin()
      ]
    });

    c.set('db', db);

    await next()
  })
