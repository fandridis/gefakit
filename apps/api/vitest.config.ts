import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig({
  environments: {
    ssr: {
      keepProcessEnv: true,
    },
  },
  test: {
    // env: {
    //   DATABASE_URL_POOLED: 'postgresql://neondb_owner:npg_v9IioTkZd6RY@ep-withered-heart-a2fk19ng-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require',
    // },
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