import Database from "better-sqlite3"
import { drizzle } from "drizzle-orm/better-sqlite3"
import { migrate } from "drizzle-orm/better-sqlite3/migrator"
import { mkdirSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import * as schema from "./schema"

const databasePath = resolve(
  process.env.ARCADIA_DB_PATH ?? join(process.cwd(), "data", "arcadia.db")
)

mkdirSync(dirname(databasePath), { recursive: true })

const sqlite = new Database(databasePath)
sqlite.pragma("journal_mode = WAL")
sqlite.pragma("synchronous = NORMAL")
sqlite.pragma("foreign_keys = ON")
sqlite.pragma("busy_timeout = 5000")

export const db = drizzle(sqlite, { schema })

migrate(db, { migrationsFolder: join(process.cwd(), "drizzle") })
