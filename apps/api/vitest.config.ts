import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig({
  test: {
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