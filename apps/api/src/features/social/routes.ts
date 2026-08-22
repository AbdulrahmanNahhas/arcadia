import {
  accountTitleStateSchema,
  createCommentInputSchema,
  familyActivitySchema,
  notificationSchema,
  reactionInputSchema,
  titleCommentSchema,
  titleReviewSchema,
  titleSocialSchema,
  upsertPlaybackInputSchema,
  upsertReviewInputSchema,
  upsertTitleStateInputSchema,
} from "@arcadia/contracts";
import { OpenAPIHono } from "@hono/zod-openapi";
import { database } from "../../database";
import { visibleTitleIdsForAccount } from "../../repository";
import { currentFamilyAccount } from "../accounts/routes";

type Row = Record<string, unknown>;
const iso = (value: unknown) => new Date(String(value)).toISOString();
const nullableIso = (value: unknown) => (value ? iso(value) : null);

function author(row: Row) {
  return {
    id: String(row.accountId),
    displayName: String(row.displayName),
    avatarKey: row.avatarKey,
  };
}

function state(row: Row | undefined) {
  if (!row) return null;
  return accountTitleStateSchema.parse({
    titleId: row.titleId,
    status: row.status,
    isFavorite: row.isFavorite,
    personalRating: row.personalRating == null ? null : Number(row.personalRating),
    notes: row.notes,
    startedAt: nullableIso(row.startedAt),
    completedAt: nullableIso(row.completedAt),
    updatedAt: iso(row.updatedAt),
  });
}

function review(row: Row) {
  return titleReviewSchema.parse({
    id: row.id,
    titleId: row.titleId,
    author: author(row),
    rating: Number(row.rating),
    body: row.body,
    containsSpoilers: row.containsSpoilers,
    reactions: row.reactions ?? {},
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  });
}

function comment(row: Row) {
  return titleCommentSchema.parse({
    id: row.id,
    titleId: row.titleId,
    parentId: row.parentId,
    author: author(row),
    body: row.body,
    containsSpoilers: row.containsSpoilers,
    reactions: row.reactions ?? {},
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  });
}

async function canSeeTitle(accountId: string, titleId: string) {
  return (await visibleTitleIdsForAccount(accountId, [titleId])).has(titleId);
}

export const socialRoutes = new OpenAPIHono();

socialRoutes.get("/api/v1/me/library", async (context) => {
  const current = await currentFamilyAccount(context.req.raw.headers);
  if (!current) return context.json({ message: "الحساب غير متاح." }, 401);
  const rows = await database().client`
    select s.title_id as "titleId", s.status, s.is_favorite as "isFavorite",
      s.personal_rating as "personalRating", s.notes, s.started_at as "startedAt",
      s.completed_at as "completedAt", s.updated_at as "updatedAt",
      coalesce(t.title_ar, t.canonical_title) as title,
      (select ma.path from media_asset_assignments x join media_assets ma on ma.id=x.asset_id
        where x.title_id=t.id and x.role='poster' and x.is_primary limit 1) as "posterPath"
    from account_title_states s join titles t on t.id=s.title_id
    where s.account_id=${current.account.id} order by s.updated_at desc`;
  const visible = await visibleTitleIdsForAccount(
    current.account.id,
    rows.map((row) => String(row.titleId)),
  );
  return context.json(
    rows
      .filter((row) => visible.has(String(row.titleId)))
      .map((row) => ({ ...state(row), title: row.title, posterPath: row.posterPath })),
  );
});

socialRoutes.put("/api/v1/me/library/:titleId", async (context) => {
  const current = await currentFamilyAccount(context.req.raw.headers);
  if (!current) return context.json({ message: "الحساب غير متاح." }, 401);
  const titleId = context.req.param("titleId");
  if (!(await canSeeTitle(current.account.id, titleId))) {
    return context.json({ message: "العمل غير متاح لهذا الحساب." }, 404);
  }
  const parsed = upsertTitleStateInputSchema.safeParse(await context.req.json());
  if (!parsed.success) return context.json({ message: "حالة المكتبة غير صالحة." }, 400);
  const [existing] = await database().client`
    select * from account_title_states where account_id=${current.account.id} and title_id=${titleId}`;
  const input = parsed.data;
  const next = {
    status: input.status !== undefined ? input.status : (existing?.status ?? null),
    isFavorite: input.isFavorite !== undefined ? input.isFavorite : Boolean(existing?.is_favorite),
    personalRating:
      input.personalRating !== undefined
        ? input.personalRating
        : (existing?.personal_rating ?? null),
    notes: input.notes !== undefined ? input.notes : String(existing?.notes ?? ""),
  };
  const now = new Date().toISOString();
  const existingStartedAt = existing?.started_at ? iso(existing.started_at) : null;
  const [saved] = await database().client`insert into account_title_states
    (account_id, title_id, status, is_favorite, personal_rating, notes, started_at, completed_at)
    values (${current.account.id}, ${titleId}, ${next.status}, ${next.isFavorite},
      ${next.personalRating}, ${next.notes},
      ${next.status === "watching" ? now : existingStartedAt},
      ${next.status === "completed" ? now : null})
    on conflict (account_id, title_id) do update set status=excluded.status,
      is_favorite=excluded.is_favorite, personal_rating=excluded.personal_rating,
      notes=excluded.notes, started_at=coalesce(account_title_states.started_at, excluded.started_at),
      completed_at=excluded.completed_at, updated_at=now()
    returning title_id as "titleId", status, is_favorite as "isFavorite",
      personal_rating as "personalRating", notes, started_at as "startedAt",
      completed_at as "completedAt", updated_at as "updatedAt"`;
  return context.json(state(saved));
});

socialRoutes.put("/api/v1/me/playback", async (context) => {
  const current = await currentFamilyAccount(context.req.raw.headers);
  if (!current) return context.json({ message: "الحساب غير متاح." }, 401);
  const parsed = upsertPlaybackInputSchema.safeParse(await context.req.json());
  if (!parsed.success) return context.json({ message: "بيانات التقدم غير صالحة." }, 400);
  const input = parsed.data;
  const [installment] = await database().client`
    select title_id from installments where id=${input.installmentId}`;
  if (!installment || !(await canSeeTitle(current.account.id, String(installment.title_id)))) {
    return context.json({ message: "الجزء غير متاح لهذا الحساب." }, 404);
  }
  const [saved] = await database().client`insert into account_playback_states
    (account_id, installment_id, episode_id, position_seconds, completed)
    values (${current.account.id}, ${input.installmentId}, ${input.episodeId},
      ${input.positionSeconds}, ${input.completed})
    on conflict (account_id, installment_id, episode_id) do update set
      position_seconds=excluded.position_seconds, completed=excluded.completed, updated_at=now()
    returning id, updated_at as "updatedAt"`;
  return context.json({ id: String(saved?.id), updatedAt: saved ? iso(saved.updatedAt) : null });
});

socialRoutes.get("/api/v1/titles/:titleId/social", async (context) => {
  const current = await currentFamilyAccount(context.req.raw.headers);
  if (!current) return context.json({ message: "الحساب غير متاح." }, 401);
  const titleId = context.req.param("titleId");
  if (!(await canSeeTitle(current.account.id, titleId))) {
    return context.json({ message: "العمل غير متاح لهذا الحساب." }, 404);
  }
  const sql = database().client;
  const [states, reviews, comments] = await Promise.all([
    sql`select title_id as "titleId", status, is_favorite as "isFavorite",
      personal_rating as "personalRating", notes, started_at as "startedAt",
      completed_at as "completedAt", updated_at as "updatedAt"
      from account_title_states where account_id=${current.account.id} and title_id=${titleId}`,
    sql`select r.id, r.title_id as "titleId", r.rating, r.body,
      r.contains_spoilers as "containsSpoilers", r.created_at as "createdAt",
      r.updated_at as "updatedAt", a.id as "accountId", a.display_name as "displayName",
      a.avatar_key as "avatarKey",
      coalesce((select json_object_agg(x.emoji, x.total) from
        (select emoji, count(*)::int as total from review_reactions rr
          where rr.review_id=r.id group by emoji) x), '{}'::json) as reactions
      from title_reviews r join accounts a on a.id=r.account_id
      where r.title_id=${titleId} and r.moderation_status='published'
      order by r.created_at desc`,
    sql`select c.id, c.title_id as "titleId", c.parent_id as "parentId", c.body,
      c.contains_spoilers as "containsSpoilers", c.created_at as "createdAt",
      c.updated_at as "updatedAt", a.id as "accountId", a.display_name as "displayName",
      a.avatar_key as "avatarKey",
      coalesce((select json_object_agg(x.emoji, x.total) from
        (select emoji, count(*)::int as total from comment_reactions cr
          where cr.comment_id=c.id group by emoji) x), '{}'::json) as reactions
      from title_comments c join accounts a on a.id=c.account_id
      where c.title_id=${titleId} and c.moderation_status='published'
      order by c.created_at`,
  ]);
  return context.json(
    titleSocialSchema.parse({
      state: state(states[0]),
      reviews: reviews.map(review),
      comments: comments.map(comment),
    }),
  );
});

socialRoutes.put("/api/v1/titles/:titleId/review", async (context) => {
  const current = await currentFamilyAccount(context.req.raw.headers);
  if (!current) return context.json({ message: "الحساب غير متاح." }, 401);
  const titleId = context.req.param("titleId");
  if (!(await canSeeTitle(current.account.id, titleId))) {
    return context.json({ message: "العمل غير متاح لهذا الحساب." }, 404);
  }
  const parsed = upsertReviewInputSchema.safeParse(await context.req.json());
  if (!parsed.success) return context.json({ message: "المراجعة غير صالحة." }, 400);
  const input = parsed.data;
  const [row] = await database().client`insert into title_reviews
    (account_id, title_id, rating, body, contains_spoilers)
    values (${current.account.id}, ${titleId}, ${input.rating}, ${input.body},
      ${input.containsSpoilers}) on conflict (account_id, title_id) do update set
      rating=excluded.rating, body=excluded.body, contains_spoilers=excluded.contains_spoilers,
      moderation_status='published', updated_at=now() returning id`;
  return context.json({ id: String(row?.id) });
});

socialRoutes.delete("/api/v1/titles/:titleId/review", async (context) => {
  const current = await currentFamilyAccount(context.req.raw.headers);
  if (!current) return context.json({ message: "الحساب غير متاح." }, 401);
  const titleId = context.req.param("titleId");
  const result = await database().client`delete from title_reviews
    where account_id=${current.account.id} and title_id=${titleId}`;
  if (!result.count) return context.json({ message: "لا توجد مراجعة لهذا الحساب." }, 404);
  return context.json({ deleted: true });
});

socialRoutes.post("/api/v1/titles/:titleId/comments", async (context) => {
  const current = await currentFamilyAccount(context.req.raw.headers);
  if (!current) return context.json({ message: "الحساب غير متاح." }, 401);
  const titleId = context.req.param("titleId");
  if (!(await canSeeTitle(current.account.id, titleId))) {
    return context.json({ message: "العمل غير متاح لهذا الحساب." }, 404);
  }
  const parsed = createCommentInputSchema.safeParse(await context.req.json());
  if (!parsed.success) return context.json({ message: "التعليق غير صالح." }, 400);
  const input = parsed.data;
  let parentAccountId: string | null = null;
  if (input.parentId) {
    const [parent] = await database().client`
      select account_id from title_comments where id=${input.parentId} and title_id=${titleId}`;
    if (!parent) return context.json({ message: "التعليق الأصلي غير موجود." }, 404);
    parentAccountId = String(parent.account_id);
  }
  const [row] = await database().client`insert into title_comments
    (account_id, title_id, parent_id, body, contains_spoilers)
    values (${current.account.id}, ${titleId}, ${input.parentId}, ${input.body},
      ${input.containsSpoilers}) returning id`;
  if (parentAccountId && parentAccountId !== current.account.id) {
    await database().client`insert into notifications
      (account_id, actor_account_id, kind, title_id, object_id, message)
      values (${parentAccountId}, ${current.account.id}, 'reply', ${titleId}, ${row?.id},
        ${`ردّ ${current.account.displayName} على تعليقك.`})`;
  }
  return context.json({ id: String(row?.id) }, 201);
});

async function toggleReaction(
  kind: "review" | "comment",
  objectId: string,
  accountId: string,
  emoji: string,
) {
  const sql = database().client;
  const rows =
    kind === "review"
      ? await sql`delete from review_reactions where review_id=${objectId}
          and account_id=${accountId} and emoji=${emoji} returning review_id`
      : await sql`delete from comment_reactions where comment_id=${objectId}
          and account_id=${accountId} and emoji=${emoji} returning comment_id`;
  if (rows.length) return false;
  if (kind === "review")
    await sql`insert into review_reactions (review_id, account_id, emoji)
      values (${objectId}, ${accountId}, ${emoji})`;
  else
    await sql`insert into comment_reactions (comment_id, account_id, emoji)
      values (${objectId}, ${accountId}, ${emoji})`;
  return true;
}

for (const kind of ["review", "comment"] as const) {
  socialRoutes.post(`/api/v1/${kind}s/:objectId/reactions`, async (context) => {
    const current = await currentFamilyAccount(context.req.raw.headers);
    if (!current) return context.json({ message: "الحساب غير متاح." }, 401);
    const parsed = reactionInputSchema.safeParse(await context.req.json());
    if (!parsed.success) return context.json({ message: "التفاعل غير صالح." }, 400);
    const active = await toggleReaction(
      kind,
      context.req.param("objectId"),
      current.account.id,
      parsed.data.emoji,
    );
    return context.json({ active });
  });
}

socialRoutes.get("/api/v1/family/activity", async (context) => {
  const current = await currentFamilyAccount(context.req.raw.headers);
  if (!current) return context.json({ message: "الحساب غير متاح." }, 401);
  const rows = await database().client`
    select activity.id, activity.kind, activity.account_id, activity.title_id,
      activity.body, activity.rating, activity.created_at,
      a.display_name, a.avatar_key, t.title_ar, t.canonical_title
    from (
      select r.id::text, 'review' as kind, r.account_id, r.title_id, r.body,
        r.rating, r.created_at from title_reviews r where r.moderation_status='published'
      union all
      select c.id::text, 'comment', c.account_id, c.title_id, c.body,
        null::integer, c.created_at from title_comments c where c.moderation_status='published'
      union all
      select concat(s.account_id, ':', s.title_id),
        case when s.is_favorite then 'favorite' else 'status' end,
        s.account_id, s.title_id, s.status::text, s.personal_rating, s.updated_at
        from account_title_states s where s.is_favorite or s.status is not null
    ) activity join accounts a on a.id=activity.account_id
    join titles t on t.id=activity.title_id where a.is_discoverable
    order by activity.created_at desc limit 60`;
  const visible = await visibleTitleIdsForAccount(
    current.account.id,
    rows.map((row) => String(row.title_id)),
  );
  return context.json(
    rows
      .filter((row) => visible.has(String(row.title_id)))
      .slice(0, 30)
      .map((row) =>
        familyActivitySchema.parse({
          id: row.id,
          kind: row.kind,
          account: {
            id: row.account_id,
            displayName: row.display_name,
            avatarKey: row.avatar_key,
          },
          title: {
            id: row.title_id,
            name: row.title_ar ?? row.canonical_title,
            posterPath: null,
          },
          body: row.body,
          rating: row.rating == null ? null : Number(row.rating),
          createdAt: iso(row.created_at),
        }),
      ),
  );
});

socialRoutes.get("/api/v1/me/notifications", async (context) => {
  const current = await currentFamilyAccount(context.req.raw.headers);
  if (!current) return context.json({ message: "الحساب غير متاح." }, 401);
  const rows = await database().client`
    select n.id, n.kind, n.message, n.title_id as "titleId", n.read_at as "readAt",
      n.created_at as "createdAt", a.id as "accountId", a.display_name as "displayName",
      a.avatar_key as "avatarKey" from notifications n
    left join accounts a on a.id=n.actor_account_id
    where n.account_id=${current.account.id} order by n.created_at desc limit 50`;
  return context.json(
    rows.map((row) =>
      notificationSchema.parse({
        ...row,
        readAt: nullableIso(row.readAt),
        createdAt: iso(row.createdAt),
        actor: row.accountId ? author(row) : null,
      }),
    ),
  );
});

socialRoutes.patch("/api/v1/me/notifications/:notificationId/read", async (context) => {
  const current = await currentFamilyAccount(context.req.raw.headers);
  if (!current) return context.json({ message: "الحساب غير متاح." }, 401);
  await database().client`update notifications set read_at=coalesce(read_at, now())
    where id=${context.req.param("notificationId")} and account_id=${current.account.id}`;
  return context.json({ read: true });
});
