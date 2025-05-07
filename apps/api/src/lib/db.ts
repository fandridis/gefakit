import { Kysely, ParseJSONResultsPlugin, PostgresDialect, Dialect } from 'kysely';
import { NeonDialect } from 'kysely-neon';
import { DB } from '../db/db-types';
import { Pool } from 'pg';

interface GetDbProps {
    connectionString: string;
    useHyperdrive?: boolean;
}

export const getDb = (options: GetDbProps): Kysely<DB> => {
    let dialect: Dialect;

    console.log('[getDb] options', options);

    if (options.useHyperdrive) {
        dialect = new NeonDialect({
            connectionString: options.connectionString,
        });
    } else {
        dialect = new PostgresDialect({
            pool: new Pool({
                max: 5,
                connectionString: options.connectionString,
            }),
        });
    }

    return new Kysely<DB>({
        dialect,
        plugins: [new ParseJSONResultsPlugin()],
    });
}; 