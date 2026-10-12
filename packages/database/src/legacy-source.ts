import { resolve } from "node:path";

/** Recovery tools require a deliberately selected source; never guess a local database. */
export function legacySourcePath() {
  const source = process.env.ARCADIA_V1_DB_PATH;
  if (!source)
    throw new Error("ARCADIA_V1_DB_PATH must identify the read-only v1 recovery database");
  return resolve(source);
}
