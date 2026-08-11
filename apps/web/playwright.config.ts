import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  use: {
    baseURL: "http://127.0.0.1:3000",
    locale: "ar-SA",
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } }
      : {}),
  },
  webServer: [
    {
      command: "pnpm --filter @arcadia/api dev",
      url: "http://127.0.0.1:3001/api/v1/health",
      reuseExistingServer: true,
      env: {
        DATABASE_URL: process.env.DATABASE_URL ?? "postgresql://127.0.0.1/arcadia",
        ARCADIA_MOCK_AUTH: "true",
      },
    },
    { command: "pnpm dev", url: "http://127.0.0.1:3000", reuseExistingServer: true },
  ],
});
