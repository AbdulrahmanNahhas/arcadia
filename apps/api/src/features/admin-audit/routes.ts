import type { AuditLogEntry } from "@arcadia/contracts";
import { OpenAPIHono } from "@hono/zod-openapi";
import { z } from "zod";
import { getAuthSession, isTestAuthBypass } from "../../auth";
import { database } from "../../database";

/**
 * The audit log viewer. Every non-GET `/api/v1/admin/*` call writes an `audit_logs` row (the
 * middleware in `app.ts`); the CLI writes its own. Reading the log of everyone's actions, and
 * pruning it, is the owner's — an editor sees a 403 here even though the admin gate let them in.
 */
export const adminAuditRoutes = new OpenAPIHono();

async function isOwner(headers: Headers) {
  if (isTestAuthBypass()) return true;
  const session = await getAuthSession(headers);
  return session?.user.role === "owner";
}

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  targetType: z.string().max(64).optional(),
  actorId: z.string().uuid().optional(),
  q: z.string().max(200).optional(),
});

type AuditRow = {
  id: string;
  actorId: string | null;
  actorName: string | null;
  actorAvatar: string | null;
  action: string;
  targetType: string;
  targetId: string | null;
  summary: string;
  changes: AuditLogEntry["changes"];
  createdAt: string | Date;
  total: string | number;
};

function mapRow(row: AuditRow): AuditLogEntry {
  return {
    id: row.id,
    actor: row.actorId
      ? { id: row.actorId, displayName: row.actorName ?? "", avatarKey: row.actorAvatar }
      : null,
    action: row.action,
    targetType: row.targetType,
    targetId: row.targetId,
    summary: row.summary,
    changes: row.changes ?? {},
    createdAt: new Date(row.createdAt).toISOString(),
  };
}

adminAuditRoutes.get("/api/v1/admin/audit-logs", async (context) => {
  if (!(await isOwner(context.req.raw.headers))) {
    return context.json({ message: "سجل العمليات متاح لمالك الأرشيف فقط." }, 403);
  }
  const parsed = listQuerySchema.safeParse(context.req.query());
  if (!parsed.success) return context.json({ message: "استعلام غير صالح." }, 400);
  const { limit, offset, targetType, actorId, q } = parsed.data;
  const sql = database().client;
  const pattern = q ? `%${q}%` : null;
  const rows = await sql<AuditRow[]>`
    select l.id, l.actor_account_id as "actorId", a.display_name as "actorName",
      a.avatar_key as "actorAvatar", l.action, l.target_type as "targetType",
      l.target_id as "targetId", l.summary, l.changes, l.created_at as "createdAt",
      count(*) over () as total
    from audit_logs l left join accounts a on a.id = l.actor_account_id
    where (${targetType ?? null}::text is null or l.target_type = ${targetType ?? null})
      and (${actorId ?? null}::uuid is null or l.actor_account_id = ${actorId ?? null})
      and (${pattern}::text is null or l.summary ilike ${pattern} or l.target_id ilike ${pattern}
        or l.action ilike ${pattern})
    order by l.created_at desc
    limit ${limit} offset ${offset}`;
  const types = await sql`select distinct target_type as "targetType" from audit_logs order by 1`;
  return context.json({
    items: rows.map(mapRow),
    total: Number(rows[0]?.total ?? 0),
    targetTypes: types.map((row) => String(row.targetType)),
  });
});

const pruneSchema = z.object({
  /** Delete entries older than this many days. */
  olderThanDays: z.number().int().min(1).max(3650),
});

adminAuditRoutes.delete("/api/v1/admin/audit-logs", async (context) => {
  if (!(await isOwner(context.req.raw.headers))) {
    return context.json({ message: "تنظيف السجل متاح لمالك الأرشيف فقط." }, 403);
  }
  const parsed = pruneSchema.safeParse(await context.req.json());
  if (!parsed.success) return context.json({ message: "مدة غير صالحة." }, 400);
  const rows = await database().client`
    delete from audit_logs
    where created_at < now() - make_interval(days => ${parsed.data.olderThanDays})
    returning id`;
  return context.json({ deleted: rows.length });
});
