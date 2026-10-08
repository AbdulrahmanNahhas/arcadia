import { defineConfig } from "@playwright/test";

const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
const isolated = process.env.NAHHASIO_E2E_ISOLATED === "true";
const baseURL = isolated ? "http://127.0.0.1:23105" : "http://127.0.0.1:23100";

export default defineConfig({
  testDir: "./tests",
  workers: isolated ? 1 : undefined,
  use: {
    baseURL,
    locale: "ar-SA",
    storageState: process.env.NAHHASIO_E2E_STORAGE_STATE,
    launchOptions: executablePath ? { executablePath } : undefined,
  },
  webServer: {
    command: isolated ? "pnpm exec vite --port 23105 --strictPort" : "pnpm dev",
    url: baseURL,
    reuseExistingServer: !isolated && !process.env.CI,
  },
});
