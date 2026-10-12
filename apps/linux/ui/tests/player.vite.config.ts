import { fileURLToPath } from "node:url";

import { defineConfig, mergeConfig } from "vite";

import application from "../vite.config";

export default mergeConfig(
  application,
  defineConfig({
    server: { port: 23112 },
    build: {
      rollupOptions: { input: fileURLToPath(new URL("./player/index.html", import.meta.url)) },
    },
  }),
);
