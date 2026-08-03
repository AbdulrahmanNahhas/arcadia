import { resolve } from "node:path";
import Database from "better-sqlite3";

const databasePath = process.env.ARCADIA_DB_PATH
  ? resolve(process.env.ARCADIA_DB_PATH)
  : resolve("data/arcadia.db");
const backupPath = process.argv[2] ? resolve(process.argv[2]) : null;

if (!backupPath) {
  throw new Error("Pass the pre-migration backup path explicitly.");
}

const sqlite = new Database(databasePath);
sqlite.pragma("foreign_keys = ON");
sqlite.prepare("attach database ? as migration_backup").run(backupPath);

const before = (
  sqlite.prepare("select count(*) as total from work_contributions").get() as { total: number }
).total;

const restore = sqlite.transaction(() => {
  sqlite
    .prepare(
      `insert or ignore into work_contributions
        (work_id, entity_id, role, is_primary, position)
      select contribution.work_id,
        canonical.id,
        case
          when contribution.role = 'main-studio' then 'animation-studio'
          when contribution.role = 'producer' and canonical.entity_type = 'organization'
            then 'production-company'
          else contribution.role
        end,
        case when contribution.role = 'main-studio' then true else false end,
        contribution.position
      from migration_backup.work_contributions contribution
      join migration_backup.entities legacy on legacy.id = contribution.entity_id
      join entities canonical on
        (legacy.entity_type = 'person' and canonical.id = legacy.id)
        or
        (legacy.entity_type <> 'person'
          and canonical.entity_type = 'organization'
          and lower(trim(canonical.sort_name)) = lower(trim(legacy.sort_name)))
      join works on works.id = contribution.work_id`,
    )
    .run();
});

restore();
const after = (
  sqlite.prepare("select count(*) as total from work_contributions").get() as { total: number }
).total;
const foreignKeyIssues = (sqlite.prepare("pragma foreign_key_check").all() as unknown[]).length;
sqlite.prepare("detach database migration_backup").run();
sqlite.close();

console.log(JSON.stringify({ databasePath, backupPath, before, after, foreignKeyIssues }, null, 2));
if (foreignKeyIssues > 0) process.exitCode = 1;
