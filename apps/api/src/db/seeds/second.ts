// seed.ts

import { Kysely } from 'kysely'
import { DB } from '../db-types'
import { config } from 'dotenv'
import { NeonDialect } from 'kysely-neon'
import { faker } from '@faker-js/faker'

// Choose a config file based on NODE_ENV
const env = process.env.NODE_ENV || 'development'
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
      connectionString: process.env.DATABASE_URL,
    }),
  })

  // Generate 100 todo items
  const todos = []
  for (let i = 0; i < 100; i++) {
    todos.push({
      title: faker.lorem.sentence(),
      description: faker.lorem.paragraph(),
      due_date: faker.date.future(),
      completed: faker.datatype.boolean(),
      author_id: 12,
    })
  }

  // Insert todos into the database
  await db.insertInto('todo').values(todos).execute()

  console.log('Database seeded successfully with 100 todos!')
  await db.destroy()
}

seed().catch((error) => {
  console.error('Failed to seed database:', error)
  process.exit(1)
})
