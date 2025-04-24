// apps/api/src/lib/config.ts
import { z } from 'zod';

// 1. Define your schema of expected env‐variables:
const EnvSchema = z.object({
  // Environment
  NODE_ENV: z.enum(['development','staging','production','test']).default('development'),

  // Database URLs
  DATABASE_URL: z.string().url(),
  DATABASE_URL_POOLED: z.string().url(),
  TEST_DATABASE_URL: z.string().url().optional(),

  // Third-party keys
  RESEND_KEY: z.string().min(1),
  GITHUB_CLIENT_ID: z.string().min(1),
  GITHUB_CLIENT_SECRET: z.string().min(1),
  GITHUB_REDIRECT_URI: z.string().url(),

  // App-specific
  APP_URL: z.string().url(),

  // …add any others here…
});

// 2. Parse & validate process.env:
const _env = EnvSchema.safeParse(process.env);
if (!_env.success) {
  console.error('❌ Invalid environment variables:', _env.error.format());
  // Exit immediately so you don't run in a broken configuration
  process.exit(1);
}

// 3. Export a fully‐typed config object:
export const envConfig = _env.data;
export type EnvConfig = typeof envConfig;
