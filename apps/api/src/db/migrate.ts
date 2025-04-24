import * as path from 'path'
import { promises as fs } from 'fs'
import {
  Kysely,
  Migrator,
  FileMigrationProvider,
} from 'kysely'
import { NeonDialect } from 'kysely-neon'
import { config } from 'dotenv'
import { envConfig } from '../lib/env-config'

// Choose a config file based on NODE_ENV
const env = envConfig.NODE_ENV || 'development'
const envFile =
  env === 'production'
    ? '.dev.vars.production'
    : env === 'staging'
    ? '.dev.vars.staging'
    : '.dev.vars'

// Load environment variables from the appropriate file
config({ path: envFile })

async function migrateToLatest() {
    const DB_URL = envConfig.NODE_ENV === 'test' ? envConfig.TEST_DATABASE_URL : envConfig.DATABASE_URL

    const db = new Kysely<any>({
        dialect: new NeonDialect({
            connectionString: DB_URL,
        }),
    })

    const migrator = new Migrator({
        db,
        provider: new FileMigrationProvider({
        fs,
        path,
        // This needs to be an absolute path.
        migrationFolder: path.join(__dirname, 'migrations'),
        }),
    })

    const { error, results } = await migrator.migrateToLatest()

    results?.forEach((it) => {
        if (it.status === 'Success') {
        console.log(`migration "${it.migrationName}" was executed successfully`)
        } else if (it.status === 'Error') {
        console.error(`failed to execute migration "${it.migrationName}"`)
        }
    })

    if (error) {
        console.error('failed to migrate')
        console.error(error)
        process.exit(1)
    }

    await db.destroy()
}

migrateToLatest()