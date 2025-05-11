import * as path from 'path'
import { promises as fs } from 'fs'
import {
    Kysely,
    Migrator,
    FileMigrationProvider,
} from 'kysely'
import { config } from 'dotenv'
import { getDb } from '../lib/db'
import { fileURLToPath } from 'url'

// don't load your .dev.vars defaults if we're testing
if (process.env.NODE_ENV === 'test') {
    // if you want to load a .env.test, you could do:
    // config({ path: '.env.test' })
} else {
    const env = process.env.NODE_ENV || 'development'
    const envFile =
        env === 'production'
            ? '.dev.vars.production'
            : '.dev.vars'
    config({ path: envFile })
}

// Get the directory path in ESM
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

console.log('================ migrate-down script =================')
console.log('WITH NODE_ENV: ', process.env.NODE_ENV)

async function migrateToLatest() {
    // order of precedence:
    // 1) MIGRATE_DATABASE_URL
    // 2) if NODE_ENV==='test', TEST_DATABASE_URL
    // 3) otherwise DATABASE_URL
    const DB_URL =
        process.env.MIGRATE_DATABASE_URL
        ?? (process.env.NODE_ENV === 'test'
            ? process.env.TEST_DATABASE_URL
            : process.env.DATABASE_URL)

    console.log('using the db_url', DB_URL)
    if (!DB_URL) {
        console.error('No database connection string provided!')
        process.exit(1)
    }

    const db = getDb({ connectionString: DB_URL })

    const migrator = new Migrator({
        db,
        provider: new FileMigrationProvider({
            fs,
            path,
            migrationFolder: path.join(__dirname, 'migrations'),
        }),
    })

    const { error, results } = await migrator.migrateDown()

    results?.forEach((it) => {
        if (it.status === 'Success') {
            console.log(`✅  migration "${it.migrationName}" was executed successfully`)
        } else if (it.status === 'Error') {
            console.error(`❌  failed to execute migration "${it.migrationName}"`)
        }
    })

    if (error) {
        console.error('Migration failed:', error)
        process.exit(1)
    }

    await db.destroy()
}

migrateToLatest().catch((err) => {
    console.error(err)
    process.exit(1)
})