import { defineConfig } from "@playwright/test";

const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
export default defineConfig({
  testDir: "./tests/player",
  testMatch: "**/*.journey.ts",
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:23112",
    launchOptions: executablePath ? { executablePath } : undefined,
  },
  webServer: {
    command:
      "pnpm exec vite --config tests/player.vite.config.ts --host 127.0.0.1 --port 23112 --strictPort",
    url: "http://127.0.0.1:23112/tests/player/",
    reuseExistingServer: false,
  },
});
