import { defineConfig } from "vitest/config";

export default defineConfig({
  // Matches vite.config.ts — without this, any test that imports app code through the `@/`
  // alias (i.e. almost all of it) fails to resolve, since vitest doesn't share Vite's resolver
  // config by default.
  resolve: { tsconfigPaths: true },
  test: {
    exclude: ["tests/**", "node_modules/**", "dist/**"],
  },
});
