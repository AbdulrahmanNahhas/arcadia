import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [tailwindcss(), tanstackStart(), react()],
  resolve: { tsconfigPaths: true },
  server: { host: "127.0.0.1", proxy: { "/api": "http://127.0.0.1:23103" } },
});
