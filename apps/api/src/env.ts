import { existsSync } from "node:fs";
import { resolve } from "node:path";

// Loads the repo-root .env (git-ignored, real secrets: TMDB/Fanart keys, …) before anything else
// reads process.env. Only used in local dev — devenv.nix supplies its own env vars directly, and
// real deployments should inject secrets through the platform, not a checked-out .env file.
// Import this module first, as a side effect, before any module that reads process.env at import
// time (see apps/api/src/server.ts).
const envPath = resolve(import.meta.dirname, "../../../.env");
if (existsSync(envPath)) process.loadEnvFile(envPath);
