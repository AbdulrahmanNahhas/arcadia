import { fileURLToPath } from "node:url";

import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./player",
  testMatch: "**/*.journey.ts",
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:23112",
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
      : undefined,
  },
  webServer: {
    cwd: fileURLToPath(new URL("..", import.meta.url)),
    command:
      "pnpm exec vite --config tests/player.vite.config.ts --host 127.0.0.1 --port 23112 --strictPort",
    url: "http://127.0.0.1:23112/tests/player/",
    reuseExistingServer: false,
  },
});
