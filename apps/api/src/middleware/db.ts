// --- middleware/db.ts ---
import { Context, Next } from 'hono';
import { Kysely, ParseJSONResultsPlugin, PostgresDialect } from 'kysely';
import { NeonDialect } from 'kysely-neon';
import { DB } from '../db/db-types';
import { Pool } from 'pg';
import { getDb } from '../lib/db';

/**
 * Injects a Kysely DB instance into the context.
 * If no instance is injected, it will create a new one.
 */
export const dbMiddleware = (injectedDb?: Kysely<DB>) => {
  return async (c: Context, next: Next) => {
    let db: Kysely<DB>;

    if (injectedDb) {
      db = injectedDb;
    } else {
      /**
       * Connecting to the DB through hyperdrive locally has some issues.
       * It can work if ran with `wrangler dev --remote` but why do that?
       * Lets just use NeonDB serverless driver for local development.
       */
      const connectionString = c.env.NODE_ENV === 'development'
        ? process.env.DATABASE_URL
        : c.env.HYPERDRIVE.connectionString;

      if (!connectionString) {
        console.error('DB connectionString is not defined in env');
        return c.json({ ok: false, error: 'Internal configuration error' }, 500);
      }
      db = getDb({
        connectionString,
        useHyperdrive: c.env.NODE_ENV === 'production',
      });
    }

    c.set('db', db);
    await next();
  };
};
