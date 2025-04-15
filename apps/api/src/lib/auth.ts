import { betterAuth } from "better-auth";
import { config } from "dotenv";
import { NeonDialect } from "kysely-neon";
import { Pool } from "pg";


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

console.log('process.env.DATABASE_URL: ', process.env.DATABASE_URL)


const dialect = new NeonDialect({
    connectionString: process.env.DATABASE_URL,
})
 
export const auth = betterAuth({
    database: {
        dialect,
        type: 'postgres',
    },
    trustedOrigins: ['http://localhost:5173', 'http://localhost:5174'],
    secret: process.env.BETTER_AUTH_SECRET,
    
    emailAndPassword: {
        enabled: true,
        // autoSignIn: false
    },
    socialProviders: { 
        github: { 
           clientId: process.env.GITHUB_CLIENT_ID as string, 
           clientSecret: process.env.GITHUB_CLIENT_SECRET as string, 
        }, 
    },
})