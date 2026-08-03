import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "./schema";

const migrationsFolder = join(process.cwd(), "drizzle");
const databasePath = resolve(
  process.env.ARCADIA_DB_PATH ?? join(process.cwd(), "data", "arcadia.db"),
);
const databaseExisted = existsSync(databasePath) && statSync(databasePath).size > 0;

mkdirSync(dirname(databasePath), { recursive: true });

export const sqlite = new Database(databasePath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("synchronous = NORMAL");
sqlite.pragma("foreign_keys = ON");
sqlite.pragma("busy_timeout = 5000");

function backupBeforePendingMigrations() {
  if (!databaseExisted) return;
  const migrationCount = readdirSync(migrationsFolder).filter(
    (file) => extname(file) === ".sql",
  ).length;
  const migrationTableExists = sqlite
    .prepare("select 1 from sqlite_master where type = 'table' and name = '__drizzle_migrations'")
    .get();
  const appliedCount = migrationTableExists
    ? (
        sqlite.prepare("select count(*) as count from __drizzle_migrations").get() as {
          count: number;
        }
      ).count
    : 0;
  if (appliedCount >= migrationCount) return;

  const backupDirectory = join(dirname(databasePath), "backups");
  const backupPath = join(
    backupDirectory,
    `${basename(databasePath, extname(databasePath))}.pre-migration-${appliedCount}-to-${migrationCount}.db`,
  );
  if (existsSync(backupPath)) return;

  mkdirSync(backupDirectory, { recursive: true });
  sqlite.pragma("wal_checkpoint(FULL)");
  copyFileSync(databasePath, backupPath);
}

backupBeforePendingMigrations();

export const db = drizzle(sqlite, { schema });

migrate(db, { migrationsFolder });
