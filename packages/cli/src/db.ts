import postgres from "postgres";
import type { Row, SqlValue } from "./types";
import { CliError } from "./output";

export type Sql = postgres.Sql<Record<string, never>>;
export type TransactionSql = postgres.TransactionSql<Record<string, never>>;

let client: Sql | undefined;

export function openDatabase(): Sql {
  if (client) return client;
  const url = process.env.DATABASE_URL ?? "postgresql://127.0.0.1/arcadia";
  client = postgres(url, {
    max: 4,
    onnotice: () => {},
    // Keep numeric/date columns as strings so scores like `8.0` survive the round trip and
    // `date` columns stay calendar dates instead of becoming timezone-shifted Date objects.
    types: {},
    transform: { undefined: null },
  });
  return client;
}

export async function closeDatabase(): Promise<void> {
  if (!client) return;
  const open = client;
  client = undefined;
  await open.end({ timeout: 5 });
}

const identifierPattern = /^[a-z_][a-z0-9_]*$/;

/** Guards every interpolated table/column name; postgres.js cannot parameterize identifiers. */
export function assertIdentifier(value: string, kind = "identifier"): string {
  if (!identifierPattern.test(value)) {
    throw new CliError(`Unsafe ${kind}: "${value}"`, "Identifiers must match /^[a-z_][a-z0-9_]*$/");
  }
  return value;
}

export function toSnakeCase(value: string): string {
  return value.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();
}

export function toCamelCase(value: string): string {
  return value.replace(/_([a-z0-9])/g, (_match, character: string) => character.toUpperCase());
}

export function camelizeRow<T extends Row>(row: T): Row {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [toCamelCase(key), value]));
}

export type AuditEntry = {
  action: string;
  targetType: string;
  targetId?: string | null;
  summary?: string;
  changes?: SqlValue;
};

/**
 * Mirrors the `audit_logs` row every non-GET admin route writes in `apps/api/src/app.ts`, so
 * catalog edits made from an agent session are as traceable as edits made from the admin UI.
 * The actor is resolved from `ARCADIA_CLI_ACTOR` (an account id, slug, or display name) and is
 * left null when unset rather than failing the write.
 */
export async function recordAudit(sql: TransactionSql | Sql, entry: AuditEntry): Promise<void> {
  const actorId = await resolveActorAccountId(sql);
  await sql`
    insert into audit_logs (actor_account_id, action, target_type, target_id, summary, changes)
    values (
      ${actorId},
      ${entry.action},
      ${entry.targetType},
      ${entry.targetId ?? null},
      ${entry.summary ?? ""},
      ${sql.json((entry.changes ?? {}) as never)}
    )`;
}

let actorCache: { value: string | null } | undefined;

async function resolveActorAccountId(sql: TransactionSql | Sql): Promise<string | null> {
  if (actorCache) return actorCache.value;
  const reference = process.env.ARCADIA_CLI_ACTOR?.trim();
  if (!reference) {
    actorCache = { value: null };
    return null;
  }
  const rows = await sql<Array<{ id: string }>>`
    select id from accounts
    where id::text = ${reference} or slug = ${reference} or display_name = ${reference}
    limit 1`;
  actorCache = { value: rows[0]?.id ?? null };
  return actorCache.value;
}

/** Reset memoized state; tests reuse the module across cases with different environments. */
export function resetActorCache(): void {
  actorCache = undefined;
}

export const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return uuidPattern.test(value);
}
