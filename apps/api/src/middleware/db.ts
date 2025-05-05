// --- middleware/db.ts ---
import { Context, Next } from 'hono';
import { Kysely, ParseJSONResultsPlugin } from 'kysely';
import { NeonDialect } from 'kysely-neon';
import { envConfig } from '../lib/env-config';
import { DB } from '../db/db-types';

/**
 * Always ensure c.vars.db is set, either from injected singleton or new connection.
 */
export const dbMiddleware = (injectedDb?: Kysely<DB>) => {
  return async (c: Context, next: Next) => {
    let db: Kysely<DB>;
    if (injectedDb) {
      db = injectedDb;
    } else {
      const url = envConfig.DATABASE_URL_POOLED;
      if (!url) {
        console.error('DATABASE_URL_POOLED is not defined');
        return c.json({ ok: false, error: 'Internal configuration error' }, 500);
      }
      db = new Kysely<DB>({
        dialect: new NeonDialect({ connectionString: url }),
        plugins: [new ParseJSONResultsPlugin()],
      });
    }
    // attach to context
    c.set('db', db);
    await next();
  };
};
