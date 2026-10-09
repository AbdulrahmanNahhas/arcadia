import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  plugins: [
    tailwindcss(),
    react(),
    {
      name: "nahhasio-production-csp",
      apply: "build",
      transformIndexHtml: (html) =>
        html.replace(
          "<head>",
          `<head><meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; font-src 'self'; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'">`,
        ),
    },
  ],
  base: "./",
  server: { host: "127.0.0.1", port: 23110, strictPort: true },
  build: { outDir: "dist" },
});
