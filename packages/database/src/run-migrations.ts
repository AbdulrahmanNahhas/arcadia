import { migrate } from "drizzle-orm/postgres-js/migrator";
import { createDatabase } from "./client";

/**
 * Applies every pending migration in `migrationsFolder` (a `drizzle/` directory with its
 * `meta/_journal.json`). Shares the journal and the `drizzle.__drizzle_migrations` table with
 * `drizzle-kit migrate`, so a database migrated by one can be continued by the other. Used by the
 * API image's `dist/migrate.js`; `pnpm db:migrate` keeps using drizzle-kit directly.
 */
export async function runMigrations(migrationsFolder: string, databaseUrl?: string) {
  const { db, client } = createDatabase(databaseUrl);
  try {
    await migrate(db, { migrationsFolder });
  } finally {
    await client.end();
  }
}
