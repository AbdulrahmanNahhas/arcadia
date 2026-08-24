import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [
    tailwindcss(),
    tanstackStart({
      // No Node server ships inside the Tauri bundle, so the app builds as a static SPA shell
      // (single prerendered HTML entry, all routing/data client-side against @arcadia/api).
      // See CLAUDE.md — do not add createServerFn/server routes to apps/web under this mode.
      // outputPath is "/index.html" (rather than the default "/_shell.html") so dist/client is a
      // ready-made static site Tauri's frontendDist can load directly.
      spa: { enabled: true, prerender: { outputPath: "/index.html" } },
    }),
    viteReact(),
  ],
  server: {
    host: "127.0.0.1",
  },
});

export default config;
