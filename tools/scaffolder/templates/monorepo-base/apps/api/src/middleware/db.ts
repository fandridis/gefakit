import { createMiddleware } from 'hono/factory'
import { Kysely, ParseJSONResultsPlugin } from 'kysely'
import { NeonDialect } from 'kysely-neon';
import { DB } from '../db/db-types';
import { Bindings } from '../types/hono';
import { envConfig } from '../lib/env-config';

export interface DbMiddleWareVariables {
  db: Kysely<DB>
}

export const dbMiddleware = createMiddleware<{ Bindings: Bindings, Variables: DbMiddleWareVariables }>(async (c, next) => {
  const db = new Kysely<DB>({
      dialect: new NeonDialect({
        connectionString: envConfig.DATABASE_URL_POOLED,
      }),
    })
    c.set('db', db);
    await next()
  })
