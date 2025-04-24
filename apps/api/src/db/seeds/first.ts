// seed.ts

import { Kysely } from 'kysely'
import { DB } from '../db-types'
import { config } from 'dotenv'
import { NeonDialect } from 'kysely-neon'
import { envConfig } from '../../lib/env-config'

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

async function seed() {
  const db = new Kysely<DB>({
    dialect: new NeonDialect({
      connectionString: envConfig.DATABASE_URL,
    }),
  })

  // Add 3 random people
  const person1 = await db
    .insertInto('person')
    .values({
      first_name: 'John',
      last_name: 'Doe',
      gender: 'male',
    })
    .returning('id')
    .executeTakeFirstOrThrow()

  const person2 = await db
    .insertInto('person')
    .values({
      first_name: 'Jane',
      last_name: 'Smith',
      gender: 'female',
    })
    .returning('id')
    .executeTakeFirstOrThrow()

  const person3 = await db
    .insertInto('person')
    .values({
      first_name: 'Alex',
      last_name: 'Johnson',
      gender: 'non-binary',
    })
    .returning('id')
    .executeTakeFirstOrThrow()

  // Add 5 pets
  await db
    .insertInto('pet')
    .values([
      {
        name: 'Fluffy',
        owner_id: person1.id,
        species: 'cat',
      },
      {
        name: 'Rex',
        owner_id: person1.id,
        species: 'dog',
      },
      {
        name: 'Whiskers',
        owner_id: person2.id,
        species: 'cat',
      },
      {
        name: 'Buddy',
        owner_id: person3.id,
        species: 'dog',
      },
      {
        name: 'Goldie',
        owner_id: person3.id,
        species: 'fish',
      },
    ])
    .execute()

  console.log('Database seeded successfully!')
  await db.destroy()
}

seed().catch((error) => {
  console.error('Failed to seed database:', error)
  process.exit(1)
})
