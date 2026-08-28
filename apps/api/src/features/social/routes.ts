import {
  accountPlaybackStateSchema,
  accountTitleStateSchema,
  bulkMarkPlayedInputSchema,
  createCommentInputSchema,
  familyActivitySchema,
  markPlayedInputSchema,
  notificationSchema,
  reactionInputSchema,
  titleCommentSchema,
  titleReviewSchema,
  titleSocialSchema,
  upsertPlaybackInputSchema,
  upsertReviewInputSchema,
  upsertTitleStateInputSchema,
} from "@arcadia/contracts";
import { nextIsPlayed } from "@arcadia/domain";
import { OpenAPIHono } from "@hono/zod-openapi";
import type postgres from "postgres";
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
    isFavorite: row.isFavorite,
    personalRating: row.personalRating == null ? null : Number(row.personalRating),
    notes: row.notes,
    updatedAt: iso(row.updatedAt),
  });
}

function playbackState(row: Row) {
  return accountPlaybackStateSchema.parse({
    id: row.id,
    installmentId: row.installmentId,
    episodeId: row.episodeId,
    titleId: row.titleId,
    positionSeconds: Number(row.positionSeconds),
    durationSeconds: row.durationSeconds == null ? null : Number(row.durationSeconds),
    isPlayed: row.isPlayed,
    playedManually: row.playedManually,
    playedAt: nullableIso(row.playedAt),
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
    select s.title_id as "titleId", s.is_favorite as "isFavorite",
      s.personal_rating as "personalRating", s.notes, s.updated_at as "updatedAt",
      coalesce(t.title_ar, t.canonical_title) as title,
      (select ma.path from media_asset_assignments x join media_assets ma on ma.id=x.asset_id
        where x.title_id=t.id and x.role='poster' and x.is_primary limit 1) as "posterPath"
    from account_title_states s join titles t on t.id=s.title_id
    where s.account_id=${current.account.id}
      and (s.is_favorite or s.personal_rating is not null or btrim(s.notes) <> '')
    order by s.updated_at desc`;
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
    isFavorite: input.isFavorite !== undefined ? input.isFavorite : Boolean(existing?.is_favorite),
    personalRating:
      input.personalRating !== undefined
        ? input.personalRating
        : (existing?.personal_rating ?? null),
    notes: input.notes !== undefined ? input.notes : String(existing?.notes ?? ""),
  };
  const [saved] = await database().client`insert into account_title_states
    (account_id, title_id, is_favorite, personal_rating, notes)
    values (${current.account.id}, ${titleId}, ${next.isFavorite},
      ${next.personalRating}, ${next.notes})
    on conflict (account_id, title_id) do update set
      is_favorite=excluded.is_favorite, personal_rating=excluded.personal_rating,
      notes=excluded.notes, updated_at=now()
    returning title_id as "titleId", is_favorite as "isFavorite",
      personal_rating as "personalRating", notes, updated_at as "updatedAt"`;
  return context.json(state(saved));
});

/**
 * Every episode/movie under an installment, at "playback row" granularity: one entry per movie
 * (`episodeId: null`) for a `movie`/`special` installment, one entry per episode for a `season`
 * installment. Shared by the single mark-played and bulk mark-played handlers below.
 */
async function playbackTargets(installmentId: string) {
  const sql = database().client;
  const [installment] = await sql`select kind from installments where id=${installmentId}`;
  if (!installment) return null;
  if (installment.kind !== "season") return [{ installmentId, episodeId: null as string | null }];
  const episodes = await sql`select id from episodes where installment_id=${installmentId}`;
  return episodes.map((episode) => ({ installmentId, episodeId: String(episode.id) }));
}

/** Upserts one playback row with an explicit, manually-chosen `isPlayed`, inside a transaction. */
async function writeManualPlayed(
  transaction: postgres.Sql | postgres.TransactionSql,
  accountId: string,
  target: { installmentId: string; episodeId: string | null },
  isPlayed: boolean,
) {
  await transaction`insert into account_playback_states
    (account_id, installment_id, episode_id, is_played, played_manually, played_at)
    values (${accountId}, ${target.installmentId}, ${target.episodeId}, ${isPlayed}, true,
      ${isPlayed ? new Date() : null})
    on conflict (account_id, installment_id, episode_id) do update set
      is_played=excluded.is_played, played_manually=true, played_at=excluded.played_at,
      updated_at=now()`;
}

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
  const [existing] = await database().client`
    select is_played, played_manually, played_at from account_playback_states
    where account_id=${current.account.id} and installment_id=${input.installmentId}
      and episode_id is not distinct from ${input.episodeId}`;
  const wasPlayed = Boolean(existing?.is_played);
  const isPlayed = nextIsPlayed({
    positionSeconds: input.positionSeconds,
    durationSeconds: input.durationSeconds,
    previouslyPlayedManually: Boolean(existing?.played_manually),
    previouslyIsPlayed: wasPlayed,
  });
  const playedAt = isPlayed ? (wasPlayed ? existing?.played_at : new Date()) : null;
  const [saved] = await database().client`insert into account_playback_states
    (account_id, installment_id, episode_id, position_seconds, duration_seconds, is_played, played_at)
    values (${current.account.id}, ${input.installmentId}, ${input.episodeId},
      ${input.positionSeconds}, ${input.durationSeconds}, ${isPlayed}, ${playedAt})
    on conflict (account_id, installment_id, episode_id) do update set
      position_seconds=excluded.position_seconds, duration_seconds=excluded.duration_seconds,
      is_played=excluded.is_played, played_at=excluded.played_at, updated_at=now()
    returning id, updated_at as "updatedAt"`;
  return context.json({ id: String(saved?.id), updatedAt: saved ? iso(saved.updatedAt) : null });
});

/**
 * A single installment/episode's playback row, or `null` when nothing has been recorded yet —
 * the player uses this to resume position and reflect the watched state on open.
 */
socialRoutes.get("/api/v1/me/playback/:installmentId", async (context) => {
  const current = await currentFamilyAccount(context.req.raw.headers);
  if (!current) return context.json({ message: "الحساب غير متاح." }, 401);
  const installmentId = context.req.param("installmentId");
  const episodeId = context.req.query("episodeId") ?? null;
  const [installment] = await database().client`
    select title_id from installments where id=${installmentId}`;
  if (!installment || !(await canSeeTitle(current.account.id, String(installment.title_id)))) {
    return context.json({ message: "الجزء غير متاح لهذا الحساب." }, 404);
  }
  const [row] = await database().client`
    select id, installment_id as "installmentId", episode_id as "episodeId",
      ${installment.title_id}::uuid as "titleId", position_seconds as "positionSeconds",
      duration_seconds as "durationSeconds", is_played as "isPlayed",
      played_manually as "playedManually", played_at as "playedAt", updated_at as "updatedAt"
    from account_playback_states
    where account_id=${current.account.id} and installment_id=${installmentId}
      and episode_id is not distinct from ${episodeId}`;
  return context.json(row ? playbackState(row) : null);
});

/**
 * Every playback row for one title (`?titleId=`) — the work-detail page's episode watched map and
 * series progress badge read this — or, with no `titleId`, "continue watching": in-progress,
 * not-yet-played rows across every title the account can see, most recent first.
 */
socialRoutes.get("/api/v1/me/playback", async (context) => {
  const current = await currentFamilyAccount(context.req.raw.headers);
  if (!current) return context.json({ message: "الحساب غير متاح." }, 401);
  const titleId = context.req.query("titleId");
  const sql = database().client;
  if (titleId) {
    if (!(await canSeeTitle(current.account.id, titleId))) {
      return context.json({ message: "العمل غير متاح لهذا الحساب." }, 404);
    }
    const rows = await sql`
      select s.id, s.installment_id as "installmentId", s.episode_id as "episodeId",
        i.title_id as "titleId", s.position_seconds as "positionSeconds",
        s.duration_seconds as "durationSeconds", s.is_played as "isPlayed",
        s.played_manually as "playedManually", s.played_at as "playedAt",
        s.updated_at as "updatedAt"
      from account_playback_states s join installments i on i.id=s.installment_id
      where s.account_id=${current.account.id} and i.title_id=${titleId}`;
    return context.json(rows.map(playbackState));
  }
  const rows = await sql`
    select s.id, s.installment_id as "installmentId", s.episode_id as "episodeId",
      i.title_id as "titleId", s.position_seconds as "positionSeconds",
      s.duration_seconds as "durationSeconds", s.is_played as "isPlayed",
      s.played_manually as "playedManually", s.played_at as "playedAt",
      s.updated_at as "updatedAt"
    from account_playback_states s join installments i on i.id=s.installment_id
    where s.account_id=${current.account.id} and not s.is_played and s.position_seconds > 0
    order by s.updated_at desc limit 30`;
  const visible = await visibleTitleIdsForAccount(
    current.account.id,
    rows.map((row) => String(row.titleId)),
  );
  return context.json(rows.filter((row) => visible.has(String(row.titleId))).map(playbackState));
});

/** Explicit watched/unwatched toggle for one movie/episode — always wins over auto-computation. */
socialRoutes.patch("/api/v1/me/playback/:installmentId/played", async (context) => {
  const current = await currentFamilyAccount(context.req.raw.headers);
  if (!current) return context.json({ message: "الحساب غير متاح." }, 401);
  const installmentId = context.req.param("installmentId");
  const parsed = markPlayedInputSchema.safeParse(await context.req.json());
  if (!parsed.success) return context.json({ message: "طلب غير صالح." }, 400);
  const input = parsed.data;
  const [installment] = await database().client`
    select title_id from installments where id=${installmentId}`;
  if (!installment || !(await canSeeTitle(current.account.id, String(installment.title_id)))) {
    return context.json({ message: "الجزء غير متاح لهذا الحساب." }, 404);
  }
  if (input.episodeId) {
    const [episode] = await database().client`
      select id from episodes where id=${input.episodeId} and installment_id=${installmentId}`;
    if (!episode) return context.json({ message: "الحلقة غير موجودة في هذا الجزء." }, 404);
  }
  await writeManualPlayed(
    database().client,
    current.account.id,
    { installmentId, episodeId: input.episodeId },
    input.isPlayed,
  );
  return context.json({ updated: true });
});

/**
 * Bulk "mark season/series as watched or unwatched": one row per movie/episode in a single
 * transaction. `installmentId: null` marks every installment under the title.
 */
socialRoutes.patch("/api/v1/titles/:titleId/playback/played", async (context) => {
  const current = await currentFamilyAccount(context.req.raw.headers);
  if (!current) return context.json({ message: "الحساب غير متاح." }, 401);
  const titleId = context.req.param("titleId");
  if (!(await canSeeTitle(current.account.id, titleId))) {
    return context.json({ message: "العمل غير متاح لهذا الحساب." }, 404);
  }
  const parsed = bulkMarkPlayedInputSchema.safeParse(await context.req.json());
  if (!parsed.success) return context.json({ message: "طلب غير صالح." }, 400);
  const input = parsed.data;

  let installmentIds: string[];
  if (input.installmentId) {
    const [installment] = await database().client`
      select id from installments where id=${input.installmentId} and title_id=${titleId}`;
    if (!installment) return context.json({ message: "الجزء غير موجود في هذا العمل." }, 404);
    installmentIds = [input.installmentId];
  } else {
    const installments = await database().client`
      select id from installments where title_id=${titleId}`;
    installmentIds = installments.map((row) => String(row.id));
  }

  const targetsByInstallment = await Promise.all(installmentIds.map(playbackTargets));
  const targets = targetsByInstallment.flatMap((rows) => rows ?? []);

  await database().client.begin(async (transaction) => {
    for (const target of targets) {
      await writeManualPlayed(transaction, current.account.id, target, input.isPlayed);
    }
  });
  return context.json({ updated: targets.length });
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
    sql`select title_id as "titleId", is_favorite as "isFavorite",
      personal_rating as "personalRating", notes, updated_at as "updatedAt"
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

socialRoutes.delete("/api/v1/titles/:titleId/comments/:commentId", async (context) => {
  const current = await currentFamilyAccount(context.req.raw.headers);
  if (!current) return context.json({ message: "الحساب غير متاح." }, 401);
  const { titleId, commentId } = context.req.param();
  const isModerator = current.account.role === "owner" || current.account.role === "editor";
  const result = isModerator
    ? await database().client`delete from title_comments
        where id=${commentId} and title_id=${titleId}`
    : await database().client`delete from title_comments
        where id=${commentId} and title_id=${titleId} and account_id=${current.account.id}`;
  if (!result.count) return context.json({ message: "لا يمكنك حذف هذا التعليق." }, 404);
  return context.json({ deleted: true });
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
      select concat(s.account_id, ':', s.title_id), 'favorite',
        s.account_id, s.title_id, null::text, s.personal_rating, s.updated_at
        from account_title_states s where s.is_favorite
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
