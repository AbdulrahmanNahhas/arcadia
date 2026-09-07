import { readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

const avatarDirectory = fileURLToPath(new URL("./public/media/avatars", import.meta.url));
const avatarCatalogId = "virtual:arcadia-avatar-catalog";
const resolvedAvatarCatalogId = `\0${avatarCatalogId}`;
const avatarFilePattern = /\.(?:png|webp|jpe?g|avif)$/i;

function avatarFiles(directory: string, prefix = ""): string[] {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const path = `${prefix}${entry.name}`;
      if (entry.isDirectory()) return avatarFiles(join(directory, entry.name), `${path}/`);
      return avatarFilePattern.test(entry.name) ? [path] : [];
    })
    .toSorted();
}

/**
 * Public assets cannot be enumerated from a packaged static site at runtime. This build-time
 * virtual module turns every curated image under `public/media/avatars` into an option, including
 * nested collections, so adding a file needs no application-code or schema change.
 */
function avatarCatalog(): Plugin {
  return {
    name: "arcadia-avatar-catalog",
    resolveId(id) {
      return id === avatarCatalogId ? resolvedAvatarCatalogId : undefined;
    },
    load(id) {
      if (id !== resolvedAvatarCatalogId) return undefined;
      return `export const avatarAssetFiles = ${JSON.stringify(avatarFiles(avatarDirectory))};`;
    },
    handleHotUpdate(context) {
      if (!context.file.startsWith(avatarDirectory)) return;
      const module = context.server.moduleGraph.getModuleById(resolvedAvatarCatalogId);
      return module ? [module] : [];
    },
  };
}

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [
    avatarCatalog(),
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
