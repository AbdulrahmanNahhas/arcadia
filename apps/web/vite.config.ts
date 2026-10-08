import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  cacheDir: process.env.NAHHASIO_E2E_ISOLATED === "true" ? "node_modules/.vite-e2e" : undefined,
  plugins: [tailwindcss(), tanstackStart(), react()],
  resolve: { tsconfigPaths: true },
  server: {
    host: "127.0.0.1",
    proxy: { "/api": process.env.NAHHASIO_API_URL ?? "http://127.0.0.1:23103" },
  },
});
