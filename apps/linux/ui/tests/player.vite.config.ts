import { fileURLToPath } from "node:url";

import { defineConfig, mergeConfig } from "vite";

import application from "../vite.config";

export default mergeConfig(
  application,
  defineConfig({
    plugins: [
      {
        name: "player-test-pending-native-export",
        // Isolated UI branch only: expose the EXISTING transport in memory until
        // the parent's bridge export arrives. No auth bypass or replacement transport.
        transform(source, id) {
          if (id.endsWith("/src/lib/bridge.ts") && !source.includes("nativeCall")) {
            return `${source}\nexport { call as nativeCall };\n`;
          }
        },
      },
    ],
    server: { port: 23112 },
    build: {
      rollupOptions: { input: fileURLToPath(new URL("./player/index.html", import.meta.url)) },
    },
  }),
);
