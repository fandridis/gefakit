/// <reference types="@cloudflare/workers-types" />

declare module "cloudflare:test" {
  // Extend this interface with bindings defined in your wrangler.jsonc
  // manually adding bindings declared in .dev.vars
  interface ProvidedEnv extends Env { 
    // Example: If you have a KV namespace binding named 'MY_KV'
    // MY_KV: KVNamespace

    // Example: If you have a Durable Object binding named 'MY_DO'
    // MY_DO: DurableObjectNamespace

    // Example: If you have a SECRET binding named 'MY_SECRET'
    // MY_SECRET: string

    // Example: If you have a D1 Database binding named 'DB'
    // DB: D1Database

    // Add bindings from your wrangler.jsonc and .dev.vars here
    // Make sure they match the types generated in worker-configuration.d.ts
  }
} 