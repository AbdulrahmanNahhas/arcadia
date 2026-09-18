import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/server.ts", "src/migrate.ts"],
  format: ["esm"],
  clean: true,
  noExternal: ["@arcadia/domain", "@arcadia/contracts", "@arcadia/database"],
});
