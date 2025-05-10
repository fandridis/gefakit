import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig({
  environments: {
    ssr: {
      keepProcessEnv: true,
    },
  },
  test: {
    env: {
      NODE_ENV: 'test',
      TEST_DATABASE_URL: process.env.TEST_DATABASE_URL,
      DATABASE_URL: process.env.DATABASE_URL
    },
    globalSetup: './test/global-setup.ts',
    setupFiles: ['./test/setup-files.ts'],
    poolOptions: {
      workers: {
        wrangler: { configPath: "./wrangler.jsonc" },
      },
      // This would override the wrangler.toml config
      //   miniflare: {
      //     kvNamespaces: ["TEST_NAMESPACE"],
      //   },
    },
  },
  // Place SSR options at the top level
  ssr: {
    optimizeDeps: {
      exclude: ["chai"],
    },
  },
});