import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [tanstackRouter({ target: "react", autoCodeSplitting: true }), tailwindcss(), react()],
  resolve: { tsconfigPaths: true },
  server: {
    host: "127.0.0.1",
    proxy: { "/api": "http://127.0.0.1:23103" },
  },
  build: { chunkSizeWarningLimit: 300 },
});
