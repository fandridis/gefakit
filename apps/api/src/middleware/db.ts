import { createMiddleware } from 'hono/factory'
import { Kysely } from 'kysely'
import { NeonDialect } from 'kysely-neon';
import { DB } from '../db/db-types';

export const dbMiddleware = createMiddleware(async (c, next) => {
    const db = new Kysely<DB>({
      dialect: new NeonDialect({
        connectionString: process.env.DATABASE_URL_POOLED,
      }),
    })
    c.set('db', db);
    await next()
  })
