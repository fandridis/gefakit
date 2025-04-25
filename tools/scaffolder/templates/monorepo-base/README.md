# GefaKit
The 5$ fullstack framework for quickly prototyping your next big idea.

## Features
- [ ] Landing Page
- [ ] Authentication
- [ ] Database
- [ ] API
- [ ] Admin Panel
- [ ] Users & Organizations
- [ ] Billing
- [ ] Localization
- [ ] Emails
- [ ] Uploads



## DEV

- Clone the repo. Not really... run `create-gefakit@latest` and follow the instructions.



## Steps I should take after cloning (Could be automated)
All steps include dev-staging-production. You can skip the staging steps for a quicker dev-production cycle.
You can always add staging later.

NOTE: We intentionally don't use `preview` from cloudflare for databases and KV namespaces because it's easier to manage different environments.

## Databses D1 - NOT USED

1. Create a new D1 dev database with: `wrangler d1 create gefakit-db-development`
2. Create a new D1 staging database with: `wrangler d1 create gefakit-db-staging`
3. Create a new D1 production database with: `wrangler d1 create gefakit-db-production`
This will return something like the following, add the database_id for each environment to the `wrangler.jsonc` file.
```
{
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "gefakit-db",
      "database_id": "12345678-1234-1234-1234-123456789012"
    }
  ]
}
```

NOTE: Need to run `npm run types` to generate the types for the database.

3. Make sure the first migration is what you want at `/src/db/migrations/0001_init.sql`. Run `npm run db:migrate:local` to apply the migrations.
Similar, you can run `npm run db:migrate:staging` and `npm run db:migrate:production` to apply the migrations to the staging and production databases.

4. Run `npm run db:seed:local` to seed the database.
Similar, you can run `npm run db:seed:staging` and `npm run db:seed:production` to seed the staging and production databases.

## DATABASES - NEON POSTGRES
Create a seperate database for each environment and set the connection strings in:
.dev.vars => DATABASE_URL and DATABASE_URL_POOLED for development
.dev.vars => DATABASE_URL and DATABASE_URL_POOLED for staging
.dev.vars => DATABASE_URL and DATABASE_URL_POOLED for production

Note: Remember to set the secrets to cloudflare environments:
`npx wrangler secret put BUCKET_APPDRIVE_PUBLIC_NAME --env staging`

Note: The development development is on-purpose

## KV
1. Create KV name space `GEFAKIT_KV` with `npx wrangler kv namespace create gefakit-kv-development`
2. Create KV name space `GEFAKIT_KV` with `npx wrangler kv namespace create gefakit-kv-staging`
3. Create KV name space `GEFAKIT_KV` with `npx wrangler kv namespace create gefakit-kv-production`

Similar to the databases, this will return something like the following, add the kv_id for each environment to the `wrangler.jsonc` file.
```
{
  "kv_namespaces": [
    {
      "binding": "gefakit_kv_development",
      "id": "65a90d4f536f4c619b49df8fc663695e"
    }
  ]
}
```