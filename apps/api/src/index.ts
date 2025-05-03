// index.ts
import { envConfig } from "./lib/env-config";
import { Kysely } from 'kysely';
import { DB } from './db/db-types';
import { NeonDialect } from 'kysely-neon';
import { createAppInstance } from "./app-factory";

const createProductionDb = (): Kysely<DB> => {
  if (!envConfig.DATABASE_URL_POOLED) {
    throw new Error('DATABASE_URL_POOLED environment variable is not set for production app initialization');
  }
  // Use the pooled URL for the main application instance
  const dialect = new NeonDialect({
    connectionString: envConfig.DATABASE_URL_POOLED,
  });

  return new Kysely<DB>({ dialect });
};

// Create the production database connection
const productionDb = createProductionDb();

// Create the main application instance using the factory and the production DB
const appInstance = createAppInstance({ db: productionDb });

// Export the configured app instance for the server/runtime
export default appInstance;
