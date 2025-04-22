import { createMiddleware } from 'hono/factory'
import { Kysely, ParseJSONResultsPlugin } from 'kysely'
import { NeonDialect } from 'kysely-neon';
import { DB } from '../db/db-types';
import { Bindings } from '../types/hono';

export interface DbMiddleWareVariables {
  db: Kysely<DB>
}

export const dbMiddleware = createMiddleware<{ Bindings: Bindings, Variables: DbMiddleWareVariables }>(async (c, next) => {
  console.log('[=== dbMiddleware ===]');
  const db = new Kysely<DB>({
      dialect: new NeonDialect({
        connectionString: process.env.DATABASE_URL_POOLED,
      }),
    })
    c.set('db', db);
    await next()
  })
