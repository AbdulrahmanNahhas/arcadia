import {
  archiveRequestInputSchema,
  archiveRequestSchema,
  archiveRequestStatusSchema,
  auditEntrySchema,
  backgroundJobSchema,
  collectionInputSchema,
  collectionItemInputSchema,
  collectionSchema,
  createRecommendationInputSchema,
  duplicateCandidateSchema,
  editorialRevisionSchema,
  familyEventInputSchema,
  familyEventSchema,
  familyRecommendationSchema,
  permissionExplanationSchema,
  recommendationStatusSchema,
  releaseCalendarItemSchema,
  savedViewInputSchema,
  savedViewSchema,
  sourceEvidenceInputSchema,
  sourceEvidenceSchema,
  viewHistoryItemSchema,
  workflowStatusSchema,
} from "@arcadia/contracts";
import { OpenAPIHono } from "@hono/zod-openapi";
import { database } from "../../database";
import { visibleTitleIdsForAccount } from "../../repository";
import { currentFamilyAccount } from "../accounts/routes";

type Row = Record<string, unknown>;
const iso = (value: unknown) => new Date(String(value)).toISOString();
const nullableIso = (value: unknown) => (value ? iso(value) : null);

function accountSummary(row: Row, prefix: string) {
  return {
    id: row[`${prefix}Id`],
    displayName: row[`${prefix}Name`],
    avatarKey: row[`${prefix}Avatar`],
  };
}

async function requireAccount(headers: Headers) {
  return currentFamilyAccount(headers);
}

async function requireEditor(headers: Headers) {
  const current = await currentFamilyAccount(headers);
  if (!current || (current.account.role !== "owner" && current.account.role !== "editor")) {
    return null;
  }
  return current;
}

export const archiveRoutes = new OpenAPIHono();

archiveRoutes.post("/api/v1/me/history/:titleId", async (context) => {
  const current = await requireAccount(context.req.raw.headers);
  if (!current) return context.json({ message: "الحساب غير متاح." }, 401);
  const titleId = context.req.param("titleId");
  const visible = await visibleTitleIdsForAccount(current.account.id, [titleId]);
  if (!visible.has(titleId)) return context.json({ message: "العمل غير متاح." }, 404);
  await database().client`insert into account_view_history (account_id, title_id)
    values (${current.account.id}, ${titleId}) on conflict (account_id, title_id) do update set
    viewed_at=now(), visit_count=account_view_history.visit_count+1`;
  return context.json({ recorded: true });
});

archiveRoutes.get("/api/v1/me/history", async (context) => {
  const current = await requireAccount(context.req.raw.headers);
  if (!current) return context.json({ message: "الحساب غير متاح." }, 401);
  const rows = await database().client`select h.title_id as "titleId", h.viewed_at as "viewedAt",
    h.visit_count as "visitCount", coalesce(t.title_ar,t.canonical_title) as title,
    (select ma.path from media_asset_assignments x join media_assets ma on ma.id=x.asset_id
      where x.title_id=t.id and x.role='poster' and x.is_primary limit 1) as "posterPath"
    from account_view_history h join titles t on t.id=h.title_id
    where h.account_id=${current.account.id} order by h.viewed_at desc limit 100`;
  const visible = await visibleTitleIdsForAccount(
    current.account.id,
    rows.map((row) => String(row.titleId)),
  );
  return context.json(
    rows
      .filter((row) => visible.has(String(row.titleId)))
      .map((row) =>
        viewHistoryItemSchema.parse({
          title: { id: row.titleId, title: row.title, posterPath: row.posterPath },
          viewedAt: iso(row.viewedAt),
          visitCount: Number(row.visitCount),
        }),
      ),
  );
});

archiveRoutes.delete("/api/v1/me/history/:titleId", async (context) => {
  const current = await requireAccount(context.req.raw.headers);
  if (!current) return context.json({ message: "الحساب غير متاح." }, 401);
  const titleId = context.req.param("titleId");
  await database().client`delete from account_view_history
    where account_id=${current.account.id} and (${titleId}='all' or title_id::text=${titleId})`;
  return context.json({ deleted: true });
});

archiveRoutes.get("/api/v1/me/saved-views", async (context) => {
  const current = await requireAccount(context.req.raw.headers);
  if (!current) return context.json({ message: "الحساب غير متاح." }, 401);
  const rows = await database().client`select id,name,query,is_default as "isDefault",
    notify_new as "notifyNew",created_at as "createdAt",updated_at as "updatedAt"
    from saved_views where account_id=${current.account.id} order by is_default desc, name`;
  return context.json(
    rows.map((row) =>
      savedViewSchema.parse({
        ...row,
        createdAt: iso(row.createdAt),
        updatedAt: iso(row.updatedAt),
      }),
    ),
  );
});

archiveRoutes.post("/api/v1/me/saved-views", async (context) => {
  const current = await requireAccount(context.req.raw.headers);
  if (!current) return context.json({ message: "الحساب غير متاح." }, 401);
  const parsed = savedViewInputSchema.safeParse(await context.req.json());
  if (!parsed.success) return context.json({ message: "طريقة العرض غير صالحة." }, 400);
  const input = parsed.data;
  const [row] = await database().client.begin(async (sql) => {
    if (input.isDefault)
      await sql`update saved_views set is_default=false where account_id=${current.account.id}`;
    return sql`insert into saved_views (account_id,name,query,is_default,notify_new)
      values (${current.account.id},${input.name},${JSON.stringify(input.query)}::jsonb,
        ${input.isDefault},${input.notifyNew}) returning id`;
  });
  return context.json({ id: String(row?.id) }, 201);
});

archiveRoutes.delete("/api/v1/me/saved-views/:viewId", async (context) => {
  const current = await requireAccount(context.req.raw.headers);
  if (!current) return context.json({ message: "الحساب غير متاح." }, 401);
  await database().client`delete from saved_views where id=${context.req.param("viewId")}
    and account_id=${current.account.id}`;
  return context.json({ deleted: true });
});

async function collectionRows(accountId: string) {
  return database().client`select c.id,c.name,c.description,c.visibility,c.is_smart as "isSmart",
    c.ranked,c.rules,c.cover_path as "coverPath",c.created_at as "createdAt",
    c.updated_at as "updatedAt",a.id as "ownerId",a.display_name as "ownerName",
    a.avatar_key as "ownerAvatar",
    (select count(*)::int from collection_contributors cc where cc.collection_id=c.id) as "contributorCount"
    from collections c join accounts a on a.id=c.owner_account_id
    where c.owner_account_id=${accountId} or c.visibility='family'
      or exists(select 1 from collection_contributors cc where cc.collection_id=c.id and cc.account_id=${accountId})
    order by c.updated_at desc`;
}

archiveRoutes.get("/api/v1/collections", async (context) => {
  const current = await requireAccount(context.req.raw.headers);
  if (!current) return context.json({ message: "الحساب غير متاح." }, 401);
  const rows = await collectionRows(current.account.id);
  const output = [];
  for (const row of rows) {
    const items = await database().client`select ci.title_id as "titleId",ci.position,ci.note,
      ci.added_at as "addedAt",coalesce(t.title_ar,t.canonical_title) as title,
      (select ma.path from media_asset_assignments x join media_assets ma on ma.id=x.asset_id
        where x.title_id=t.id and x.role='poster' and x.is_primary limit 1) as "posterPath"
      from collection_items ci join titles t on t.id=ci.title_id where ci.collection_id=${row.id}
      order by ci.position,ci.added_at`;
    const visible = await visibleTitleIdsForAccount(
      current.account.id,
      items.map((item) => String(item.titleId)),
    );
    output.push(
      collectionSchema.parse({
        ...row,
        owner: accountSummary(row, "owner"),
        contributorCount: Number(row.contributorCount),
        items: items
          .filter((item) => visible.has(String(item.titleId)))
          .map((item) => ({
            title: { id: item.titleId, title: item.title, posterPath: item.posterPath },
            position: Number(item.position),
            note: item.note,
            addedAt: iso(item.addedAt),
          })),
        createdAt: iso(row.createdAt),
        updatedAt: iso(row.updatedAt),
      }),
    );
  }
  return context.json(output);
});

archiveRoutes.post("/api/v1/collections", async (context) => {
  const current = await requireAccount(context.req.raw.headers);
  if (!current) return context.json({ message: "الحساب غير متاح." }, 401);
  const parsed = collectionInputSchema.safeParse(await context.req.json());
  if (!parsed.success) return context.json({ message: "بيانات المجموعة غير صالحة." }, 400);
  const input = parsed.data;
  const [row] = await database().client`insert into collections
    (owner_account_id,name,description,visibility,is_smart,ranked,rules)
    values (${current.account.id},${input.name},${input.description},${input.visibility},
      ${input.isSmart},${input.ranked},${input.rules ? JSON.stringify(input.rules) : null}::jsonb)
    returning id`;
  return context.json({ id: String(row?.id) }, 201);
});

archiveRoutes.post("/api/v1/collections/:collectionId/items", async (context) => {
  const current = await requireAccount(context.req.raw.headers);
  if (!current) return context.json({ message: "الحساب غير متاح." }, 401);
  const parsed = collectionItemInputSchema.safeParse(await context.req.json());
  if (!parsed.success) return context.json({ message: "عنصر المجموعة غير صالح." }, 400);
  const collectionId = context.req.param("collectionId");
  const [allowed] = await database()
    .client`select c.id from collections c where c.id=${collectionId}
    and (c.owner_account_id=${current.account.id} or exists(select 1 from collection_contributors cc
      where cc.collection_id=c.id and cc.account_id=${current.account.id}))`;
  if (!allowed) return context.json({ message: "لا يمكنك تعديل هذه المجموعة." }, 403);
  const [position] = await database().client`select coalesce(max(position),-1)+1 as value
    from collection_items where collection_id=${collectionId}`;
  await database().client`insert into collection_items
    (collection_id,title_id,position,note,added_by_account_id)
    values (${collectionId},${parsed.data.titleId},${Number(position?.value ?? 0)},
      ${parsed.data.note},${current.account.id}) on conflict (collection_id,title_id) do update set
      note=excluded.note`;
  await database().client`update collections set updated_at=now() where id=${collectionId}`;
  return context.json({ added: true });
});

archiveRoutes.get("/api/v1/calendar/releases", async (context) => {
  const current = await requireAccount(context.req.raw.headers);
  if (!current) return context.json({ message: "الحساب غير متاح." }, 401);
  const rows = await database().client`select i.id as "installmentId",t.id as "titleId",
    coalesce(t.title_ar,t.canonical_title) as title,i.title as "installmentTitle",i.kind,
    i.release_date as "releaseDate",(f.account_id is not null) as followed
    from installments i join titles t on t.id=i.title_id left join title_follows f
      on f.title_id=t.id and f.account_id=${current.account.id}
    where i.release_date between current_date-interval '30 days' and current_date+interval '365 days'
    order by i.release_date`;
  const visible = await visibleTitleIdsForAccount(
    current.account.id,
    rows.map((row) => String(row.titleId)),
  );
  return context.json(
    rows
      .filter((row) => visible.has(String(row.titleId)))
      .map((row) => releaseCalendarItemSchema.parse(row)),
  );
});

archiveRoutes.put("/api/v1/me/follows/:titleId", async (context) => {
  const current = await requireAccount(context.req.raw.headers);
  if (!current) return context.json({ message: "الحساب غير متاح." }, 401);
  const titleId = context.req.param("titleId");
  const deleted = await database().client`delete from title_follows
    where account_id=${current.account.id} and title_id=${titleId} returning title_id`;
  if (deleted.length) return context.json({ followed: false });
  await database().client`insert into title_follows (account_id,title_id)
    values (${current.account.id},${titleId})`;
  return context.json({ followed: true });
});

archiveRoutes.get("/api/v1/family/recommendations", async (context) => {
  const current = await requireAccount(context.req.raw.headers);
  if (!current) return context.json({ message: "الحساب غير متاح." }, 401);
  const rows = await database().client`select r.id,r.reason,r.status,r.created_at as "createdAt",
    r.responded_at as "respondedAt",s.id as "senderId",s.display_name as "senderName",
    s.avatar_key as "senderAvatar",d.id as "recipientId",d.display_name as "recipientName",
    d.avatar_key as "recipientAvatar",t.id as "titleId",coalesce(t.title_ar,t.canonical_title) as title,
    (select ma.path from media_asset_assignments x join media_assets ma on ma.id=x.asset_id
      where x.title_id=t.id and x.role='poster' and x.is_primary limit 1) as "posterPath"
    from family_recommendations r join accounts s on s.id=r.sender_account_id
    join accounts d on d.id=r.recipient_account_id join titles t on t.id=r.title_id
    where r.sender_account_id=${current.account.id} or r.recipient_account_id=${current.account.id}
    order by r.created_at desc`;
  return context.json(
    rows.map((row) =>
      familyRecommendationSchema.parse({
        ...row,
        sender: accountSummary(row, "sender"),
        recipient: accountSummary(row, "recipient"),
        title: { id: row.titleId, title: row.title, posterPath: row.posterPath },
        createdAt: iso(row.createdAt),
        respondedAt: nullableIso(row.respondedAt),
      }),
    ),
  );
});

archiveRoutes.post("/api/v1/family/recommendations", async (context) => {
  const current = await requireAccount(context.req.raw.headers);
  if (!current) return context.json({ message: "الحساب غير متاح." }, 401);
  const parsed = createRecommendationInputSchema.safeParse(await context.req.json());
  if (!parsed.success || parsed.data.recipientAccountId === current.account.id)
    return context.json({ message: "التوصية غير صالحة." }, 400);
  const input = parsed.data;
  const [row] = await database().client`insert into family_recommendations
    (sender_account_id,recipient_account_id,title_id,reason)
    values (${current.account.id},${input.recipientAccountId},${input.titleId},${input.reason}) returning id`;
  await database().client`insert into notifications
    (account_id,actor_account_id,kind,title_id,object_id,message)
    values (${input.recipientAccountId},${current.account.id},'catalog',${input.titleId},${row?.id},
      ${`رشّح لك ${current.account.displayName} عملاً جديداً.`})`;
  return context.json({ id: String(row?.id) }, 201);
});

archiveRoutes.patch("/api/v1/family/recommendations/:recommendationId", async (context) => {
  const current = await requireAccount(context.req.raw.headers);
  if (!current) return context.json({ message: "الحساب غير متاح." }, 401);
  const status = recommendationStatusSchema.safeParse((await context.req.json()).status);
  if (!status.success) return context.json({ message: "الحالة غير صالحة." }, 400);
  await database().client`update family_recommendations set status=${status.data},responded_at=now()
    where id=${context.req.param("recommendationId")} and recipient_account_id=${current.account.id}`;
  return context.json({ updated: true });
});

archiveRoutes.get("/api/v1/family/events", async (context) => {
  const current = await requireAccount(context.req.raw.headers);
  if (!current) return context.json({ message: "الحساب غير متاح." }, 401);
  const events = await database()
    .client`select e.id,e.name,e.notes,e.scheduled_for as "scheduledFor",
    e.status,e.created_at as "createdAt",a.id as "creatorId",a.display_name as "creatorName",
    a.avatar_key as "creatorAvatar" from family_events e join accounts a on a.id=e.created_by_account_id
    order by e.created_at desc limit 30`;
  const output = [];
  for (const event of events) {
    const candidates = await database()
      .client`select t.id as "titleId",coalesce(t.title_ar,t.canonical_title) as title,
      (select ma.path from media_asset_assignments x join media_assets ma on ma.id=x.asset_id
        where x.title_id=t.id and x.role='poster' and x.is_primary limit 1) as "posterPath",
      count(v.account_id)::int as votes,bool_or(v.account_id=${current.account.id}) as "votedByMe"
      from family_event_candidates c join titles t on t.id=c.title_id left join family_event_votes v
        on v.event_id=c.event_id and v.title_id=c.title_id where c.event_id=${event.id}
      group by t.id order by votes desc,title`;
    output.push(
      familyEventSchema.parse({
        ...event,
        creator: accountSummary(event, "creator"),
        candidates: candidates.map((candidate) => ({
          title: {
            id: candidate.titleId,
            title: candidate.title,
            posterPath: candidate.posterPath,
          },
          votes: Number(candidate.votes),
          votedByMe: Boolean(candidate.votedByMe),
        })),
        scheduledFor: nullableIso(event.scheduledFor),
        createdAt: iso(event.createdAt),
      }),
    );
  }
  return context.json(output);
});

archiveRoutes.post("/api/v1/family/events", async (context) => {
  const current = await requireAccount(context.req.raw.headers);
  if (!current) return context.json({ message: "الحساب غير متاح." }, 401);
  const parsed = familyEventInputSchema.safeParse(await context.req.json());
  if (!parsed.success) return context.json({ message: "بيانات الموعد غير صالحة." }, 400);
  const input = parsed.data;
  const id = await database().client.begin(async (sql) => {
    const [event] =
      await sql`insert into family_events (created_by_account_id,name,notes,scheduled_for,status)
      values (${current.account.id},${input.name},${input.notes},${input.scheduledFor},
        ${input.scheduledFor ? "scheduled" : "planning"}) returning id`;
    for (const titleId of input.candidateTitleIds)
      await sql`insert into family_event_candidates
      (event_id,title_id,nominated_by_account_id) values (${event?.id},${titleId},${current.account.id})`;
    return String(event?.id);
  });
  return context.json({ id }, 201);
});

archiveRoutes.post("/api/v1/family/events/:eventId/votes/:titleId", async (context) => {
  const current = await requireAccount(context.req.raw.headers);
  if (!current) return context.json({ message: "الحساب غير متاح." }, 401);
  const eventId = context.req.param("eventId"),
    titleId = context.req.param("titleId");
  const deleted = await database().client`delete from family_event_votes where event_id=${eventId}
    and title_id=${titleId} and account_id=${current.account.id} returning account_id`;
  if (!deleted.length)
    await database().client`insert into family_event_votes(event_id,title_id,account_id)
    values (${eventId},${titleId},${current.account.id})`;
  return context.json({ voted: !deleted.length });
});

archiveRoutes.get("/api/v1/archive/requests", async (context) => {
  const current = await requireAccount(context.req.raw.headers);
  if (!current) return context.json({ message: "الحساب غير متاح." }, 401);
  const admin = current.account.role === "owner" || current.account.role === "editor";
  const rows = await database()
    .client`select r.id,r.kind,r.status,r.title,r.body,r.target_type as "targetType",
    r.target_id as "targetId",r.created_at as "createdAt",r.updated_at as "updatedAt",
    a.id as "requesterId",a.display_name as "requesterName",a.avatar_key as "requesterAvatar"
    from archive_requests r join accounts a on a.id=r.requested_by_account_id
    where ${admin} or r.requested_by_account_id=${current.account.id} order by r.created_at desc`;
  return context.json(
    rows.map((row) =>
      archiveRequestSchema.parse({
        ...row,
        requester: accountSummary(row, "requester"),
        createdAt: iso(row.createdAt),
        updatedAt: iso(row.updatedAt),
      }),
    ),
  );
});

archiveRoutes.post("/api/v1/archive/requests", async (context) => {
  const current = await requireAccount(context.req.raw.headers);
  if (!current) return context.json({ message: "الحساب غير متاح." }, 401);
  const parsed = archiveRequestInputSchema.safeParse(await context.req.json());
  if (!parsed.success) return context.json({ message: "الطلب غير صالح." }, 400);
  const input = parsed.data;
  const [row] = await database().client`insert into archive_requests
    (requested_by_account_id,kind,title,body,target_type,target_id)
    values (${current.account.id},${input.kind},${input.title},${input.body},${input.targetType},${input.targetId})
    returning id`;
  return context.json({ id: String(row?.id) }, 201);
});

archiveRoutes.patch("/api/v1/admin/archive/requests/:requestId", async (context) => {
  const current = await requireEditor(context.req.raw.headers);
  if (!current) return context.json({ message: "صلاحية التحرير مطلوبة." }, 403);
  const body = (await context.req.json()) as { status?: string; resolution?: string };
  const status = archiveRequestStatusSchema.safeParse(body.status);
  if (!status.success) return context.json({ message: "الحالة غير صالحة." }, 400);
  await database()
    .client`update archive_requests set status=${status.data},resolution=${body.resolution ?? ""},
    assigned_to_account_id=${current.account.id},updated_at=now() where id=${context.req.param("requestId")}`;
  return context.json({ updated: true });
});

archiveRoutes.get("/api/v1/admin/archive/audit", async (context) => {
  const current = await requireEditor(context.req.raw.headers);
  if (!current) return context.json({ message: "صلاحية التحرير مطلوبة." }, 403);
  const rows = await database()
    .client`select l.id,l.action,l.target_type as "targetType",l.target_id as "targetId",
    l.summary,l.changes,l.created_at as "createdAt",a.display_name as "actorName"
    from audit_logs l left join accounts a on a.id=l.actor_account_id order by l.created_at desc limit 100`;
  return context.json(
    rows.map((row) => auditEntrySchema.parse({ ...row, createdAt: iso(row.createdAt) })),
  );
});

archiveRoutes.get("/api/v1/admin/archive/quality", async (context) => {
  const current = await requireEditor(context.req.raw.headers);
  if (!current) return context.json({ message: "صلاحية التحرير مطلوبة." }, 403);
  const rows = await database().client`select t.id,coalesce(t.title_ar,t.canonical_title) as label,
    array_remove(array[
      case when t.title_ar is null then 'العنوان العربي مفقود' end,
      case when btrim(t.summary)='' then 'الملخص مفقود' end,
      case when t.release_year is null then 'سنة الإصدار مفقودة' end,
      case when not exists(select 1 from media_asset_assignments x where x.title_id=t.id and x.role='poster') then 'الملصق مفقود' end,
      case when not exists(select 1 from installments i where i.title_id=t.id) then 'لا توجد أجزاء' end,
      case when not exists(select 1 from title_planets p where p.title_id=t.id) then 'الكوكب غير معيّن' end,
      case when not exists(select 1 from contributions c where c.title_id=t.id) then 'صنّاع العمل مفقودون' end,
      case when not exists(select 1 from title_genres g where g.title_id=t.id) then 'النوع غير مصنّف' end
    ],null) as issues from titles t order by t.updated_at desc`;
  return context.json(
    rows.map((row) => ({
      entityType: "title",
      entityId: String(row.id),
      label: String(row.label),
      score: Math.max(0, 100 - (row.issues as unknown[]).length * 12),
      issues: row.issues,
    })),
  );
});

archiveRoutes.get("/api/v1/admin/archive/duplicates", async (context) => {
  const current = await requireEditor(context.req.raw.headers);
  if (!current) return context.json({ message: "صلاحية التحرير مطلوبة." }, 403);
  const rows = await database()
    .client`select entity_type as "entityType",normalized_value as "normalizedValue",
    json_agg(json_build_object('id',id,'label',label) order by label) as candidates from (
      select 'title' as entity_type,regexp_replace(lower(coalesce(title_ar,canonical_title)),'[[:space:][:punct:]]','','g') as normalized_value,
        id::text,coalesce(title_ar,canonical_title) as label from titles
      union all
      select 'entity',regexp_replace(lower(name),'[[:space:][:punct:]]','','g'),id::text,name from entities
    ) candidate_values where normalized_value<>'' group by entity_type,normalized_value having count(*)>1 order by count(*) desc`;
  return context.json(rows.map((row) => duplicateCandidateSchema.parse(row)));
});

archiveRoutes.get("/api/v1/admin/revisions/:entityType/:entityId", async (context) => {
  const current = await requireEditor(context.req.raw.headers);
  if (!current) return context.json({ message: "صلاحية التحرير مطلوبة." }, 403);
  const entityType = context.req.param("entityType");
  const entityId = context.req.param("entityId");
  const rows = await database()
    .client`select r.id,r.revision,r.action,r.summary,r.snapshot,r.changes,
    r.created_at as "createdAt",a.display_name as "actorName" from editorial_revisions r
    left join accounts a on a.id=r.actor_account_id where r.entity_type=${entityType}
      and r.entity_id=${entityId} order by r.revision desc limit 50`;
  return context.json(
    rows.map((row) =>
      editorialRevisionSchema.parse({
        ...row,
        targetType: entityType,
        targetId: entityId,
        createdAt: iso(row.createdAt),
      }),
    ),
  );
});

archiveRoutes.get("/api/v1/admin/evidence/:entityType/:entityId", async (context) => {
  const current = await requireEditor(context.req.raw.headers);
  if (!current) return context.json({ message: "صلاحية التحرير مطلوبة." }, 403);
  const rows = await database()
    .client`select id,entity_type as "entityType",entity_id as "entityId",
    field_path as "fieldPath",source_note as "sourceNote",source_url as "sourceUrl",
    verification_status as "verificationStatus",checked_at as "checkedAt",
    created_at as "createdAt",updated_at as "updatedAt" from source_evidence
    where entity_type=${context.req.param("entityType")} and entity_id=${context.req.param("entityId")}
    order by field_path,created_at desc`;
  return context.json(
    rows.map((row) =>
      sourceEvidenceSchema.parse({
        ...row,
        checkedAt: nullableIso(row.checkedAt),
        createdAt: iso(row.createdAt),
        updatedAt: iso(row.updatedAt),
      }),
    ),
  );
});

archiveRoutes.post("/api/v1/admin/evidence", async (context) => {
  const current = await requireEditor(context.req.raw.headers);
  if (!current) return context.json({ message: "صلاحية التحرير مطلوبة." }, 403);
  const parsed = sourceEvidenceInputSchema.safeParse(await context.req.json());
  if (!parsed.success) return context.json({ message: "بيانات المصدر غير صالحة." }, 400);
  const input = parsed.data;
  const [row] = await database().client`insert into source_evidence
    (entity_type,entity_id,field_path,source_note,source_url,verification_status,
      checked_by_account_id,checked_at) values (${input.entityType},${input.entityId},${input.fieldPath},
      ${input.sourceNote},${input.sourceUrl},${input.verificationStatus},
      ${input.verificationStatus === "unverified" ? null : current.account.id},
      ${input.verificationStatus === "unverified" ? null : new Date().toISOString()}) returning id`;
  return context.json({ id: String(row?.id) }, 201);
});

archiveRoutes.patch("/api/v1/admin/titles/:titleId/workflow", async (context) => {
  const current = await requireEditor(context.req.raw.headers);
  if (!current) return context.json({ message: "صلاحية التحرير مطلوبة." }, 403);
  const parsed = workflowStatusSchema.safeParse((await context.req.json()).status);
  if (!parsed.success) return context.json({ message: "حالة النشر غير صالحة." }, 400);
  const titleId = context.req.param("titleId");
  await database().client.begin(async (sql) => {
    await sql`update titles set workflow_status=${parsed.data},updated_at=now() where id=${titleId}`;
    await sql`insert into audit_logs(actor_account_id,action,target_type,target_id,summary,changes)
      values (${current.account.id},'workflow.transition','title',${titleId},
        ${`نقل العمل إلى ${parsed.data}`},${JSON.stringify({ status: parsed.data })}::jsonb)`;
  });
  return context.json({ status: parsed.data });
});

archiveRoutes.get("/api/v1/admin/archive/jobs", async (context) => {
  const current = await requireEditor(context.req.raw.headers);
  if (!current) return context.json({ message: "صلاحية التحرير مطلوبة." }, 403);
  const rows = await database()
    .client`select id,type,status,progress,result,error,created_at as "createdAt",
    finished_at as "finishedAt" from background_jobs order by created_at desc limit 50`;
  return context.json(
    rows.map((row) =>
      backgroundJobSchema.parse({
        ...row,
        progress: Number(row.progress),
        createdAt: iso(row.createdAt),
        finishedAt: nullableIso(row.finishedAt),
      }),
    ),
  );
});

archiveRoutes.post("/api/v1/admin/archive/jobs", async (context) => {
  const current = await requireEditor(context.req.raw.headers);
  if (!current) return context.json({ message: "صلاحية التحرير مطلوبة." }, 403);
  const body = (await context.req.json()) as { type?: string; payload?: Record<string, unknown> };
  const allowed = new Set([
    "validate",
    "recalculate-quality",
    "inspect-media",
    "refresh-collections",
    "export",
  ]);
  if (!body.type || !allowed.has(body.type))
    return context.json({ message: "نوع المهمة غير صالح." }, 400);
  const [row] = await database().client`insert into background_jobs
    (created_by_account_id,type,status,progress,payload,result,started_at,finished_at)
    values (${current.account.id},${body.type},'completed',100,${JSON.stringify(body.payload ?? {})}::jsonb,
      ${JSON.stringify({ message: "اكتملت المعاينة المحلية." })}::jsonb,now(),now()) returning id`;
  return context.json({ id: String(row?.id) }, 201);
});

archiveRoutes.get("/api/v1/admin/archive/export", async (context) => {
  const current = await requireEditor(context.req.raw.headers);
  if (!current) return context.json({ message: "صلاحية التحرير مطلوبة." }, 403);
  const [titles, entities, planets, awards] = await Promise.all([
    database().client`select * from titles order by sort_title`,
    database().client`select * from entities order by sort_name`,
    database().client`select * from planets order by display_order`,
    database().client`select * from award_recognitions order by year desc nulls last`,
  ]);
  return context.json({
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    titles,
    entities,
    planets,
    awards,
  });
});

archiveRoutes.get("/api/v1/admin/accounts/:accountId/explain/:titleId", async (context) => {
  const current = await requireEditor(context.req.raw.headers);
  if (!current) return context.json({ message: "صلاحية التحرير مطلوبة." }, 403);
  const accountId = context.req.param("accountId"),
    titleId = context.req.param("titleId");
  const visible = await visibleTitleIdsForAccount(accountId, [titleId]);
  const blocked = await database().client`select
    exists(select 1 from account_title_blocks where account_id=${accountId} and title_id=${titleId}) as title,
    exists(select 1 from account_planet_blocks b join title_planets p on p.planet_id=b.planet_id
      where b.account_id=${accountId} and p.title_id=${titleId}) as planet`;
  const row = blocked[0];
  const reasons = visible.has(titleId)
    ? ["العمل يطابق سياسة المحتوى ولا يوجد حظر صريح"]
    : [
        row?.title ? "العمل مخفي صراحةً لهذا الحساب" : "لا يطابق حد المحتوى الفعّال",
        ...(row?.planet ? ["الكوكب المرتبط بالعمل مخفي"] : []),
      ];
  return context.json(
    permissionExplanationSchema.parse({
      accountId,
      targetType: "title",
      targetId: titleId,
      allowed: visible.has(titleId),
      reasons,
    }),
  );
});
