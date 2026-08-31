import {
  adminArtworkIngestSchema,
  adminEntityContributionDeleteSchema,
  adminEntityContributionInputSchema,
  adminEntityInputSchema,
  adminEntitySchema,
  adminMediaAssignmentSchema,
  adminMediaSearchSchema,
  adminMediaUploadSchema,
  adminPlanetSchema,
  adminStatisticsSchema,
  adminVocabularyInputSchema,
  artworkSearchQuerySchema,
  browseQuerySchema,
  browseResponseSchema,
  healthSchema,
  installmentStreamsSchema,
  installmentSubtitlesSchema,
  type mediaAssetSchema,
  streamErrorSchema,
  titleDetailSchema,
  validationIssueSchema,
  vocabularyNameSchema,
  vocabularyTermSchema,
} from "@arcadia/contracts";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { cors } from "hono/cors";
import { auth, getAuthSession, isTestAuthBypass } from "./auth";
import { database, databaseReady } from "./database";
import { accountRoutes, currentFamilyAccount } from "./features/accounts/routes";
import { archiveRoutes } from "./features/archive/routes";
import { awardRoutes } from "./features/awards/routes";
import { socialRoutes } from "./features/social/routes";
import {
  applyTitleWrite,
  defaultPreservedTitleFields,
  type LegacyTitleWritePayload,
  parseLegacyTitleInput,
  TitleWriteError,
} from "./features/titles/write";
import { searchArtwork } from "./integrations/artwork-search";
import {
  downloadSubtitleFile,
  fetchSubtitleCandidates,
  subtitleSourceConfigured,
} from "./integrations/opensubtitles";
import {
  fetchStreamCandidates,
  streamSourceConfigured,
  tmdbStreamIdsAllowed,
} from "./integrations/torrent-source";
import {
  type mediaKinds,
  removeStoredMedia,
  storedMediaExists,
  storeMedia,
  storeMediaFromUrl,
} from "./media-storage";
import {
  browse,
  titleDetail,
  visibilityPolicyForAccount,
  visibleTitleIdsForAccount,
} from "./repository";

export const app = new OpenAPIHono();
const trustedOrigins = new Set([
  process.env.ARCADIA_WEB_URL ?? "http://127.0.0.1:3000",
  "http://localhost:3000",
]);
app.use(
  "*",
  cors({
    origin: (origin) => (trustedOrigins.has(origin) ? origin : [...trustedOrigins][0]),
    credentials: true,
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  }),
);
app.on(["GET", "POST"], "/api/auth/*", (context) => {
  if (context.req.path.startsWith("/api/auth/sign-up")) {
    return context.json({ message: "إنشاء الحسابات متاح بالدعوة أو عبر المدير فقط." }, 404);
  }
  return auth.handler(context.req.raw);
});
app.use("/api/v1/*", async (context, next) => {
  if (
    context.req.path === "/api/v1/health" ||
    context.req.path.startsWith("/api/v1/invites/") ||
    isTestAuthBypass()
  ) {
    await next();
    return;
  }
  const session = await getAuthSession(context.req.raw.headers);
  if (!session) return context.json({ message: "يلزم تسجيل الدخول للوصول إلى أركاديا." }, 401);
  await next();
});
app.use("/api/v1/admin/*", async (context, next) => {
  await next();
  if (context.req.method === "GET" || context.res.status >= 400) return;
  const current = await currentFamilyAccount(context.req.raw.headers);
  if (!current) return;
  const segments = context.req.path.split("/").filter(Boolean);
  const targetType = segments[3] ?? "admin";
  const targetId = segments.at(-1) === targetType ? null : (segments.at(-1) ?? null);
  await database().client`insert into audit_logs
    (actor_account_id,action,target_type,target_id,summary,changes)
    values (${current.account.id},${`admin.${context.req.method.toLowerCase()}`},${targetType},
      ${targetId},${`نفّذ ${current.account.displayName} عملية ${context.req.method} على ${context.req.path}`},
      ${JSON.stringify({ path: context.req.path, method: context.req.method })}::jsonb)`;
});
app.route("/", accountRoutes);
app.route("/", awardRoutes);
app.route("/", archiveRoutes);
app.route("/", socialRoutes);

const errorSchema = z.object({ message: z.string() });
type AdminScoreInput = Partial<{
  story: number | null;
  characters: number | null;
  depth: number | null;
  worldBuilding: number | null;
  originality: number | null;
  craft: number | null;
}>;
/**
 * `LegacyTitleWritePayload` (from `./features/titles/write`) plus the installment-level
 * shortcuts `legacyTitleInputToCanonical` deliberately doesn't map (`kind`/`releaseStatus`/
 * `runtimeMinutes` — still handled ad hoc below, since the legacy client still conflates a
 * movie title with its single installment). No longer carries `awards` — the title editor's
 * Awards tab now saves each recognition immediately through
 * `/api/v1/admin/awards/recognitions` (Stage 2), so a title's own save payload never includes
 * them anymore.
 */
type LegacyTitleRoutePayload = LegacyTitleWritePayload &
  Partial<{
    kind: string;
    releaseStatus: string;
    runtimeMinutes: number | null;
  }>;

const contributionRoleSlugs = new Set([
  "creator",
  "original_author",
  "director",
  "writer",
  "producer",
  "executive_producer",
  "creative_producer",
  "character_designer",
  "art_director",
  "scene_design",
  "composer",
  "animation_studio",
  "production_company",
  "distributor",
  "publisher",
]);
type AdminStructureUnit = Partial<{
  title: string | null;
  summary: string;
  unitNumber: number;
  position: number;
  releaseAt: number;
  runtimeMinutes: number | null;
}>;
type AdminStructureSeason = Partial<{
  id: string;
  title: string;
  installmentKind: "season" | "movie" | "special";
  summary: string;
  releaseStatus: string;
  posterPath: string | null;
  score: AdminScoreInput;
  position: number;
  releaseAt: number;
  runtimeMinutes: number | null;
  units: AdminStructureUnit[];
  tmdbId: number | null;
  imdbId: string | null;
  tvdbId: number | null;
  anilistId: number | null;
  malId: number | null;
}>;
function initialInstallmentStatus(value: string | undefined) {
  if (value === "upcoming" || value === "announced") return "announced";
  if (value === "airing") return "airing";
  if (value === "returning" || value === "completed") return "completed";
  return "unknown";
}
const adminScoreSchema = z.object({
  story: z.number().min(0).max(10).nullable().optional(),
  characters: z.number().min(0).max(10).nullable().optional(),
  depth: z.number().min(0).max(10).nullable().optional(),
  worldBuilding: z.number().min(0).max(10).nullable().optional(),
  originality: z.number().min(0).max(10).nullable().optional(),
  craft: z.number().min(0).max(10).nullable().optional(),
});
const adminStructureSchema = z.object({
  seasons: z
    .array(
      z.object({
        id: z.string().optional(),
        title: z.string().trim().min(1),
        installmentKind: z.enum(["season", "movie", "special"]).default("season"),
        summary: z.string().default(""),
        releaseStatus: z.enum(["announced", "airing", "completed", "unknown"]).default("unknown"),
        posterPath: z.string().nullable().default(null),
        position: z.number().int().min(0),
        releaseAt: z.number().nullable().optional(),
        runtimeMinutes: z.number().int().min(0).nullable().optional(),
        score: adminScoreSchema.optional(),
        tmdbId: z.number().int().positive().nullable().optional(),
        imdbId: z
          .string()
          .regex(/^tt\d{7,10}$/)
          .nullable()
          .optional(),
        tvdbId: z.number().int().positive().nullable().optional(),
        anilistId: z.number().int().positive().nullable().optional(),
        malId: z.number().int().positive().nullable().optional(),
        units: z
          .array(
            z.object({
              id: z.string().optional(),
              unitType: z.literal("episode").default("episode"),
              title: z.string().nullable().optional(),
              summary: z.string().default(""),
              unitNumber: z.number().positive().nullable().optional(),
              position: z.number().int().min(0),
              releaseAt: z.number().nullable().optional(),
              runtimeMinutes: z.number().int().min(0).nullable().optional(),
            }),
          )
          .default([]),
      }),
    )
    .default([]),
  ungroupedUnits: z.array(z.unknown()).max(0).default([]),
});

async function purgeUnreferencedMedia(paths: Array<string | null | undefined>) {
  const sql = database().client;
  for (const path of new Set(paths.filter((value): value is string => Boolean(value)))) {
    if (!path.startsWith("/media/uploads/")) continue;
    const [usage] = await sql`select a.id,
      exists(select 1 from media_asset_assignments x where x.asset_id=a.id) as referenced
      from media_assets a where a.path=${path}`;
    if (!usage?.referenced) {
      try {
        await removeStoredMedia(path);
        if (usage?.id) await sql`delete from media_assets where id=${usage.id}`;
      } catch (error) {
        if (usage?.id)
          await sql`update media_assets set deletion_error=${error instanceof Error ? error.message : "File deletion failed"}, updated_at=now() where id=${usage.id}`;
        console.warn(`Could not remove unreferenced media ${path}`, error);
      }
    }
  }
}

async function materializeEmbeddedMedia(
  value: string | null | undefined,
  ownerName: string,
  assetType: (typeof mediaKinds)[number],
) {
  if (!value?.startsWith("data:image/")) return value ?? null;
  const stored = await storeMedia({
    dataUrl: value,
    fileName: `${ownerName}-${assetType}`,
    ownerName,
    assetType,
  });
  const [existing] = await database()
    .client`select path from media_assets where sha256=${stored.sha256}`;
  if (existing) {
    if (existing.path !== stored.relativePath) await removeStoredMedia(stored.relativePath);
    return String(existing.path);
  }
  await database().client`
    insert into media_assets (path, sha256, mime_type, byte_size, width, height, original_filename)
    values (${stored.relativePath}, ${stored.sha256}, ${stored.mimeType}, ${stored.byteSize}, ${stored.width}, ${stored.height}, ${stored.originalFilename})`;
  return stored.relativePath;
}

type MediaOwner = {
  titleId?: string;
  installmentId?: string;
  episodeId?: string;
  entityId?: string;
};

async function assignMediaPath(
  sql: ReturnType<typeof database>["client"],
  path: string | null | undefined,
  role: (typeof mediaKinds)[number],
  owner: MediaOwner,
  isPrimary = true,
) {
  const ownerEntries = Object.entries(owner).filter(([, value]) => value);
  if (ownerEntries.length !== 1) throw new Error("Exactly one media owner is required");
  const ownerColumns = {
    titleId: "title_id",
    installmentId: "installment_id",
    episodeId: "episode_id",
    entityId: "entity_id",
  } as const;
  const [ownerKey, ownerId] = ownerEntries[0] as [keyof typeof ownerColumns, string];
  const ownerColumn = ownerColumns[ownerKey];
  const previous = isPrimary
    ? await sql`select ma.path from media_asset_assignments x join media_assets ma on ma.id=x.asset_id where x.${sql(ownerColumn)}=${ownerId} and x.role=${role} and x.is_primary`
    : [];
  if (isPrimary)
    await sql`delete from media_asset_assignments where ${sql(ownerColumn)}=${ownerId} and role=${role} and is_primary`;
  if (path) {
    const [asset] = await sql`select id from media_assets where path=${path}`;
    if (!asset) throw new Error("The selected media asset is not registered");
    await sql`insert into media_asset_assignments (asset_id, role, ${sql(ownerColumn)}, is_primary)
      values (${asset.id}, ${role}, ${ownerId}, ${isPrimary}) on conflict do nothing`;
  }
  await purgeUnreferencedMedia(previous.map((row) => String(row.path)));
}

async function contributionValidationError(
  sql: ReturnType<typeof database>["client"],
  contributors: LegacyTitleRoutePayload["contributors"],
) {
  if (!contributors?.length) return null;
  const entityIds = [...new Set(contributors.map((credit) => credit.entityId))];
  const roleSlugs = [...new Set(contributors.map((credit) => credit.role))];
  const rows =
    await sql`select e.id as entity_id, e.kind as entity_kind, r.slug, r.entity_kind as role_entity_kind
    from entities e cross join roles r
    where e.id in ${sql(entityIds)} and r.slug in ${sql(roleSlugs)}`;
  const compatible = new Set(
    rows
      .filter((row) => row.entity_kind === row.role_entity_kind)
      .map((row) => `${row.entity_id}:${row.slug}`),
  );
  const invalid = contributors.find(
    (credit) =>
      !contributionRoleSlugs.has(credit.role) ||
      !compatible.has(`${credit.entityId}:${credit.role}`),
  );
  return invalid
    ? `Role ${invalid.role} is not valid for the selected person or organization.`
    : null;
}
const healthRoute = createRoute({
  method: "get",
  path: "/api/v1/health",
  responses: {
    200: {
      content: { "application/json": { schema: healthSchema } },
      description: "API and database readiness",
    },
  },
});
app.openapi(healthRoute, async (context) =>
  context.json({
    status: (await databaseReady()) ? "ok" : "degraded",
    database: (await databaseReady()) ? "ready" : "unavailable",
    version: "v2",
  }),
);

const browseRoute = createRoute({
  method: "get",
  path: "/api/v1/titles",
  request: { query: browseQuerySchema },
  responses: {
    200: {
      content: { "application/json": { schema: browseResponseSchema } },
      description: "Browse umbrella titles or flattened installments",
    },
  },
});
app.openapi(browseRoute, async (context) => {
  const current = await currentFamilyAccount(context.req.raw.headers);
  return context.json(await browse(context.req.valid("query"), false, current?.account.id));
});

const detailRoute = createRoute({
  method: "get",
  path: "/api/v1/titles/{titleId}",
  request: { params: z.object({ titleId: z.string().uuid() }) },
  responses: {
    200: {
      content: { "application/json": { schema: titleDetailSchema } },
      description: "Title details",
    },
    404: {
      content: { "application/json": { schema: errorSchema } },
      description: "Title not found",
    },
  },
});
app.openapi(detailRoute, async (context) => {
  const current = await currentFamilyAccount(context.req.raw.headers);
  const session = await getAuthSession(context.req.raw.headers);
  const includePrivate = session?.user.role === "owner" || session?.user.role === "editor";
  const detail = await titleDetail(
    context.req.valid("param").titleId,
    includePrivate,
    current?.account.id,
  );
  return detail ? context.json(detail, 200) : context.json({ message: "Title not found" }, 404);
});

/**
 * Ranked playback sources for one installment (see `docs/player-torrent-roadmap.md`, Phase 1.5).
 * Discovery lives on the API rather than in the desktop shell so the addon URL stays out of a
 * shipped binary and one upstream call serves the whole family.
 *
 * Every failure gets its own code. The player has to be able to tell the family "this film has no
 * identifier yet" apart from "the source is down" apart from "there are no sources" — the
 * roadmap's rule is a specific, honest message, never a spinner that never resolves.
 */
const installmentStreamsRoute = createRoute({
  method: "get",
  path: "/api/v1/installments/{installmentId}/streams",
  request: {
    params: z.object({ installmentId: z.string().uuid() }),
    query: z.object({ episodeId: z.string().uuid().optional() }),
  },
  responses: {
    200: {
      content: { "application/json": { schema: installmentStreamsSchema } },
      description: "Ranked playback sources, best first",
    },
    400: {
      content: { "application/json": { schema: streamErrorSchema } },
      description: "This installment kind cannot be streamed yet",
    },
    403: {
      content: { "application/json": { schema: streamErrorSchema } },
      description: "The account cannot see this title",
    },
    404: {
      content: { "application/json": { schema: streamErrorSchema } },
      description: "Installment not found",
    },
    409: {
      content: { "application/json": { schema: streamErrorSchema } },
      description: "The installment carries no identifier the addon accepts",
    },
    502: {
      content: { "application/json": { schema: streamErrorSchema } },
      description: "The stream source did not answer",
    },
    503: {
      content: { "application/json": { schema: streamErrorSchema } },
      description: "No stream source is configured in this deployment",
    },
  },
});
app.openapi(installmentStreamsRoute, async (context) => {
  const { installmentId } = context.req.valid("param");
  const { episodeId } = context.req.valid("query");
  const [row] = await database().client`
    select i.title_id, i.kind, i.position, i.imdb_id, i.tmdb_id,
      t.imdb_id as title_imdb_id, t.tmdb_id as title_tmdb_id, t.is_private,
      (select count(*) from installments sibling
        where sibling.title_id = i.title_id and sibling.kind in ('movie', 'special')) as film_count,
      (select count(*) from installments sibling
        where sibling.title_id = i.title_id and sibling.kind = 'season'
          and sibling.position < i.position) + 1 as season_number
    from installments i join titles t on t.id = i.title_id
    where i.id = ${installmentId}`;

  const session = await getAuthSession(context.req.raw.headers);
  const isStaff = session?.user.role === "owner" || session?.user.role === "editor";
  if (!row || (row.is_private && !isStaff)) {
    return context.json({ code: "not_found" as const, message: "لم يُعثر على هذا العمل." }, 404);
  }
  const titleId = String(row.title_id);

  // The play button being hidden is not access control. Without this, a restricted account that
  // knows an installment id could resolve a stream for a title it cannot see. `visibleTitleIds-
  // ForAccount` applies the whole policy — audience/age/risk classification and per-account
  // blocks — not just the private flag, so playback inherits the same rules browsing has.
  const current = await currentFamilyAccount(context.req.raw.headers);
  if (current) {
    const visible = await visibleTitleIdsForAccount(current.account.id, [titleId]);
    if (!visible.has(titleId)) {
      return context.json(
        { code: "not_permitted" as const, message: "هذا العمل خارج نطاق ملفك." },
        403,
      );
    }
  }

  if (row.kind === "season") {
    if (!episodeId) {
      return context.json(
        { code: "unsupported_kind" as const, message: "لم يُحدَّد رقم الحلقة." },
        400,
      );
    }

    const [episode] = await database().client`
      select number::float as number from episodes
      where id = ${episodeId} and installment_id = ${installmentId}`;
    if (!episode) {
      return context.json({ code: "not_found" as const, message: "لم يُعثر على هذه الحلقة." }, 404);
    }
    if (!Number.isInteger(episode.number)) {
      return context.json(
        { code: "no_identifier" as const, message: "رقم حلقة غير صحيح لتحديد مصدر البث." },
        409,
      );
    }

    if (!streamSourceConfigured()) {
      return context.json(
        { code: "source_not_configured" as const, message: "لم يُضبط مصدر البث في هذا التثبيت." },
        503,
      );
    }

    const resolvedSeries = resolveSeriesStreamId({
      titleImdbId: row.title_imdb_id ? String(row.title_imdb_id) : null,
      titleTmdbId: positiveIntegerOrNull(row.title_tmdb_id ? String(row.title_tmdb_id) : null),
    });
    if (!resolvedSeries) {
      return context.json(
        {
          code: "no_identifier" as const,
          message: "لا يحمل هذا العنوان معرّف IMDb بعد، فتعذّر البحث عن مصادر تشغيله.",
        },
        409,
      );
    }

    const seriesStreamId = `${resolvedSeries.id}:${Number(row.season_number)}:${episode.number}`;
    const seriesCandidates = await fetchStreamCandidates({
      type: "series",
      id: seriesStreamId,
      preferredAudio: current?.account.preferences.preferredAudio,
    });
    if (!seriesCandidates) {
      return context.json(
        { code: "source_unavailable" as const, message: "تعذّر الوصول إلى مصدر البث." },
        502,
      );
    }

    return context.json(
      {
        installmentId,
        titleId,
        streamId: seriesStreamId,
        idSource: resolvedSeries.idSource,
        candidates: seriesCandidates,
      },
      200,
    );
  }

  if (!streamSourceConfigured()) {
    return context.json(
      { code: "source_not_configured" as const, message: "لم يُضبط مصدر البث في هذا التثبيت." },
      503,
    );
  }

  const resolved = resolveStreamId({
    installmentImdbId: row.imdb_id ? String(row.imdb_id) : null,
    installmentTmdbId: positiveIntegerOrNull(row.tmdb_id ? String(row.tmdb_id) : null),
    titleImdbId: row.title_imdb_id ? String(row.title_imdb_id) : null,
    titleTmdbId: positiveIntegerOrNull(row.title_tmdb_id ? String(row.title_tmdb_id) : null),
    filmCount: Number(row.film_count),
  });
  if (!resolved) {
    return context.json(
      {
        code: "no_identifier" as const,
        message: "لا يحمل هذا الفيلم معرّف IMDb بعد، فتعذّر البحث عن مصادر تشغيله.",
      },
      409,
    );
  }

  const candidates = await fetchStreamCandidates({
    type: "movie",
    id: resolved.streamId,
    preferredAudio: current?.account.preferences.preferredAudio,
  });
  if (!candidates) {
    return context.json(
      { code: "source_unavailable" as const, message: "تعذّر الوصول إلى مصدر البث." },
      502,
    );
  }

  return context.json(
    {
      installmentId,
      titleId,
      streamId: resolved.streamId,
      idSource: resolved.idSource,
      candidates,
    },
    200,
  );
});

/**
 * `installments.imdb_id` first, then the same two ids on the parent title — but only when the
 * title has exactly one film under it, since otherwise the title's id names a different work
 * than the installment being played. `tmdb:` ids stay behind a flag until the family's addon is
 * confirmed to accept them (roadmap open question); an addon that doesn't answers with an empty
 * `streams` array rather than an error, which would look like "no sources" instead of "wrong id".
 */
function positiveIntegerOrNull(value: string | number | null) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function resolveStreamId(ids: {
  installmentImdbId: string | null;
  installmentTmdbId: number | null;
  titleImdbId: string | null;
  titleTmdbId: number | null;
  filmCount: number;
}) {
  const allowTmdb = tmdbStreamIdsAllowed();
  const isOnlyFilm = ids.filmCount === 1;
  if (ids.installmentImdbId) {
    return { streamId: ids.installmentImdbId, idSource: "installment.imdb" as const };
  }
  if (allowTmdb && ids.installmentTmdbId) {
    return { streamId: `tmdb:${ids.installmentTmdbId}`, idSource: "installment.tmdb" as const };
  }
  if (isOnlyFilm && ids.titleImdbId) {
    return { streamId: ids.titleImdbId, idSource: "title.imdb" as const };
  }
  if (isOnlyFilm && allowTmdb && ids.titleTmdbId) {
    return { streamId: `tmdb:${ids.titleTmdbId}`, idSource: "title.tmdb" as const };
  }
  return null;
}

/**
 * A season installment never carries its own `imdb_id`/`tmdb_id` (Phase 0's design), so series
 * resolution has no installment-level fallback and no `filmCount` guard to worry about — it is
 * always the title's id, unconditionally.
 */
function resolveSeriesStreamId(ids: { titleImdbId: string | null; titleTmdbId: number | null }) {
  if (ids.titleImdbId) {
    return { id: ids.titleImdbId, idSource: "title.imdb" as const };
  }
  if (tmdbStreamIdsAllowed() && ids.titleTmdbId) {
    return { id: `tmdb:${ids.titleTmdbId}`, idSource: "title.tmdb" as const };
  }
  return null;
}

/**
 * Subtitle discovery (roadmap Phase 2). Deliberately mirrors the streams route's shape — same
 * visibility check, same season/episode resolution rules, same generic `streamErrorSchema` codes
 * — but is a separate handler rather than a shared refactor of the already-covered streams route,
 * to avoid touching its tested id-resolution paths in the same change that adds subtitles.
 */
const installmentSubtitlesRoute = createRoute({
  method: "get",
  path: "/api/v1/installments/{installmentId}/subtitles",
  request: {
    params: z.object({ installmentId: z.string().uuid() }),
    query: z.object({
      episodeId: z.string().uuid().optional(),
      videoHash: z.string().optional(),
      languages: z.string().optional(),
    }),
  },
  responses: {
    200: {
      content: { "application/json": { schema: installmentSubtitlesSchema } },
      description: "Ranked subtitle candidates, best match first",
    },
    400: {
      content: { "application/json": { schema: streamErrorSchema } },
      description: "A season with no episode selected",
    },
    403: {
      content: { "application/json": { schema: streamErrorSchema } },
      description: "The account cannot see this title",
    },
    404: {
      content: { "application/json": { schema: streamErrorSchema } },
      description: "Installment (or episode) not found",
    },
    409: {
      content: { "application/json": { schema: streamErrorSchema } },
      description: "Neither a video hash nor an IMDb id is available to search by",
    },
    502: {
      content: { "application/json": { schema: streamErrorSchema } },
      description: "OpenSubtitles did not answer",
    },
    503: {
      content: { "application/json": { schema: streamErrorSchema } },
      description: "No subtitle source is configured in this deployment",
    },
  },
});
app.openapi(installmentSubtitlesRoute, async (context) => {
  const { installmentId } = context.req.valid("param");
  const { episodeId, videoHash, languages } = context.req.valid("query");
  const [row] = await database().client`
    select i.title_id, i.kind, i.position, i.imdb_id,
      t.imdb_id as title_imdb_id, t.is_private,
      (select count(*) from installments sibling
        where sibling.title_id = i.title_id and sibling.kind in ('movie', 'special')) as film_count,
      (select count(*) from installments sibling
        where sibling.title_id = i.title_id and sibling.kind = 'season'
          and sibling.position < i.position) + 1 as season_number
    from installments i join titles t on t.id = i.title_id
    where i.id = ${installmentId}`;

  const session = await getAuthSession(context.req.raw.headers);
  const isStaff = session?.user.role === "owner" || session?.user.role === "editor";
  if (!row || (row.is_private && !isStaff)) {
    return context.json({ code: "not_found" as const, message: "لم يُعثر على هذا العمل." }, 404);
  }
  const titleId = String(row.title_id);

  const current = await currentFamilyAccount(context.req.raw.headers);
  if (current) {
    const visible = await visibleTitleIdsForAccount(current.account.id, [titleId]);
    if (!visible.has(titleId)) {
      return context.json(
        { code: "not_permitted" as const, message: "هذا العمل خارج نطاق ملفك." },
        403,
      );
    }
  }

  let imdbId: string | null = null;
  let season: number | null = null;
  let episode: number | null = null;

  if (row.kind === "season") {
    if (!episodeId) {
      return context.json(
        { code: "unsupported_kind" as const, message: "لم يُحدَّد رقم الحلقة." },
        400,
      );
    }
    const [episodeRow] = await database().client`
      select number::float as number from episodes
      where id = ${episodeId} and installment_id = ${installmentId}`;
    if (!episodeRow) {
      return context.json({ code: "not_found" as const, message: "لم يُعثر على هذه الحلقة." }, 404);
    }
    imdbId = row.title_imdb_id ? String(row.title_imdb_id) : null;
    season = Number(row.season_number);
    episode = Number.isInteger(episodeRow.number) ? Number(episodeRow.number) : null;
  } else {
    const isOnlyFilm = Number(row.film_count) === 1;
    imdbId = row.imdb_id
      ? String(row.imdb_id)
      : isOnlyFilm && row.title_imdb_id
        ? String(row.title_imdb_id)
        : null;
  }

  if (!videoHash && !imdbId) {
    return context.json(
      {
        code: "no_identifier" as const,
        message: "لا يحمل هذا العمل معرّف IMDb، ولا مصدر تشغيل نشط لمطابقة الترجمة به.",
      },
      409,
    );
  }

  if (!subtitleSourceConfigured()) {
    return context.json(
      { code: "source_not_configured" as const, message: "لم يُضبط مصدر الترجمة في هذا التثبيت." },
      503,
    );
  }

  const candidates = await fetchSubtitleCandidates({
    imdbId,
    season,
    episode,
    videoHash: videoHash ?? null,
    videoSize: null,
    languages: languages ? languages.split(",").map((value: string) => value.trim()) : ["ar", "en"],
  });
  if (!candidates) {
    return context.json(
      { code: "source_unavailable" as const, message: "تعذّر الوصول إلى مصدر الترجمة." },
      502,
    );
  }

  return context.json({ installmentId, titleId, candidates }, 200);
});

/**
 * Downloading is a separate route from search because OpenSubtitles' download link is a
 * short-lived, quota-counted resource: fetching it only when a specific candidate is chosen keeps
 * the search response cheap to render and never spends a download credit the family didn't ask
 * for. The visibility check is repeated here — a restricted account should not be able to pull a
 * subtitle file for an installment it cannot see just because it knows the id.
 *
 * A plain (non-OpenAPI-typed) route, like the other file-serving/binary responses in this file —
 * `app.openapi()`'s response typing is built around JSON bodies, not a raw byte stream.
 */
app.get("/api/v1/installments/:installmentId/subtitles/:fileId/download", async (context) => {
  const installmentId = context.req.param("installmentId");
  const fileId = Number(context.req.param("fileId"));
  if (!z.string().uuid().safeParse(installmentId).success || !Number.isInteger(fileId)) {
    return context.json({ code: "not_found" as const, message: "لم يُعثر على هذا العمل." }, 404);
  }
  const [row] = await database().client`
    select i.title_id, t.is_private from installments i join titles t on t.id = i.title_id
    where i.id = ${installmentId}`;

  const session = await getAuthSession(context.req.raw.headers);
  const isStaff = session?.user.role === "owner" || session?.user.role === "editor";
  if (!row || (row.is_private && !isStaff)) {
    return context.json({ code: "not_found" as const, message: "لم يُعثر على هذا العمل." }, 404);
  }
  const titleId = String(row.title_id);

  const current = await currentFamilyAccount(context.req.raw.headers);
  if (current) {
    const visible = await visibleTitleIdsForAccount(current.account.id, [titleId]);
    if (!visible.has(titleId)) {
      return context.json(
        { code: "not_permitted" as const, message: "هذا العمل خارج نطاق ملفك." },
        403,
      );
    }
  }

  if (!subtitleSourceConfigured()) {
    return context.json(
      { code: "source_not_configured" as const, message: "لم يُضبط مصدر الترجمة في هذا التثبيت." },
      503,
    );
  }

  const file = await downloadSubtitleFile(fileId);
  if (!file) {
    return context.json(
      { code: "source_unavailable" as const, message: "تعذّر تنزيل ملف الترجمة." },
      502,
    );
  }

  return new Response(Buffer.from(file.bytes), {
    status: 200,
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${file.fileName ?? `subtitle-${fileId}.srt`}"`,
    },
  });
});

const listSchema = z.array(z.record(z.string(), z.unknown()));
for (const resource of ["planets", "people", "studios", "relationships"] as const) {
  const route = createRoute({
    method: "get",
    path: `/api/v1/${resource}`,
    responses: {
      200: {
        content: { "application/json": { schema: listSchema } },
        description: `List ${resource}`,
      },
    },
  });
  app.openapi(route, async (context) => {
    const sql = database().client;
    const rows =
      resource === "planets"
        ? await sql`select id, slug, name_ar as "nameAr", name_en as "nameEn", icon, description, primary_color as "primaryColor", secondary_color as "secondaryColor" from planets where is_active order by display_order`
        : resource === "people"
          ? await sql`select e.id, e.name, e.sort_name as "sortName", e.description,
              (select ma.path from media_asset_assignments x join media_assets ma on ma.id=x.asset_id where x.entity_id=e.id and x.role='profile' and x.is_primary limit 1) as "profilePath",
              coalesce((select json_agg(item order by item.title) from (
                select t.id, t.canonical_title as title, t.title_ar as "arabicTitle", t.release_year as year,
                  case when bool_or(i.kind='season') then 'anime' else 'movie' end as kind,
                  case
                    when count(i.id) = 0 or bool_or(i.status = 'unknown') then 'unknown'
                    when bool_or(i.status = 'airing') then 'airing'
                    when bool_and(i.status = 'announced') then 'upcoming'
                    when bool_or(i.status = 'announced') and bool_or(i.status = 'completed') then 'returning'
                    when bool_and(i.status = 'completed') then 'completed'
                    else 'unknown'
                  end as "releaseStatus", (select ma.path from media_asset_assignments x join media_assets ma on ma.id=x.asset_id where x.title_id=t.id and x.role='poster' and x.is_primary limit 1) as "imagePath",
                  array_agg(distinct r.slug) as roles
                from contributions c join titles t on t.id=c.title_id join roles r on r.id=c.role_id
                left join installments i on i.title_id=t.id where c.entity_id=e.id and not t.is_private
                group by t.id
              ) item), '[]'::json) as works
            from entities e where e.kind='person' order by e.sort_name`
          : resource === "studios"
            ? await sql`select e.id, e.name, e.sort_name as "sortName", e.description,
                (select ma.path from media_asset_assignments x join media_assets ma on ma.id=x.asset_id where x.entity_id=e.id and x.role='profile' and x.is_primary limit 1) as "profilePath",
                coalesce((select json_agg(item order by item.title) from (
                  select t.id, t.canonical_title as title, t.title_ar as "arabicTitle", t.release_year as year,
                    case when bool_or(i.kind='season') then 'anime' else 'movie' end as kind,
                  case
                    when count(i.id) = 0 or bool_or(i.status = 'unknown') then 'unknown'
                    when bool_or(i.status = 'airing') then 'airing'
                    when bool_and(i.status = 'announced') then 'upcoming'
                    when bool_or(i.status = 'announced') and bool_or(i.status = 'completed') then 'returning'
                    when bool_and(i.status = 'completed') then 'completed'
                    else 'unknown'
                  end as "releaseStatus", (select ma.path from media_asset_assignments x join media_assets ma on ma.id=x.asset_id where x.title_id=t.id and x.role='poster' and x.is_primary limit 1) as "imagePath",
                    array_agg(distinct r.slug) as roles
                  from contributions c join titles t on t.id=c.title_id join roles r on r.id=c.role_id
                  left join installments i on i.title_id=t.id where c.entity_id=e.id and not t.is_private
                  group by t.id
                ) item), '[]'::json) as works
              from entities e where e.kind='organization' order by e.sort_name`
            : await sql`select r.id, r.source_title_id as "sourceTitleId", r.target_title_id as "targetTitleId", r.kind from title_relations r join titles source on source.id=r.source_title_id join titles target on target.id=r.target_title_id where not source.is_private and not target.is_private`;
    const current = await currentFamilyAccount(context.req.raw.headers);
    if (!current) return context.json(rows);
    const policy = await visibilityPolicyForAccount(current.account.id);
    if (!policy) return context.json([]);
    if (resource === "planets") {
      return context.json(rows.filter((row) => !policy.blockedPlanetIds.has(String(row.id))));
    }
    if (resource === "relationships") {
      const relatedIds = rows.flatMap((row) => [
        String(row.sourceTitleId),
        String(row.targetTitleId),
      ]);
      const visibleIds = await visibleTitleIdsForAccount(current.account.id, relatedIds);
      return context.json(
        rows.filter(
          (row) =>
            visibleIds.has(String(row.sourceTitleId)) && visibleIds.has(String(row.targetTitleId)),
        ),
      );
    }
    const visibleEntities = rows.filter((row) => !policy.blockedEntityIds.has(String(row.id)));
    const workIds = visibleEntities.flatMap((row) => {
      const works = Array.isArray(row.works) ? row.works : [];
      return works.map((work) => String((work as { id: unknown }).id));
    });
    const visibleWorkIds = await visibleTitleIdsForAccount(current.account.id, workIds);
    return context.json(
      visibleEntities.map((row) => ({
        ...row,
        works: (Array.isArray(row.works) ? row.works : []).filter((work) =>
          visibleWorkIds.has(String((work as { id: unknown }).id)),
        ),
      })),
    );
  });
}

app.get("/api/v1/organization-relationships", async (context) => {
  const rows = await database()
    .client`select id, source_id as "sourceId", target_id as "targetId", relation_type as "relationType", occurred_on as "occurredOn", description from organization_relations order by occurred_on nulls last`;
  return context.json(rows);
});

app.get("/api/v1/vocabularies", async (context) => {
  const sql = database().client;
  const rows = await sql`
    select id::text, 'genres' as vocabulary, slug, label_en, label_ar, description_en, description_ar, position, is_active, null::entity_kind as entity_kind from genres where is_active
    union all select id::text, 'tones', slug, label_en, label_ar, description_en, description_ar, position, is_active, null::entity_kind from tones where is_active
    union all select id::text, 'tags', slug, label_en, label_ar, description_en, description_ar, position, is_active, null::entity_kind from tags where is_active
    union all select id::text, 'countries', slug, label_en, label_ar, description_en, description_ar, position, is_active, null::entity_kind from countries where is_active
    union all select id::text, 'roles', slug, label_en, label_ar, description_en, description_ar, position, is_active, entity_kind from roles where is_active
    union all select vocabulary || ':' || value, vocabulary, value, label_en, label_ar, description_en, description_ar, position, is_active, null::entity_kind from vocabulary_labels where is_active
    order by vocabulary, position`;
  return context.json(
    rows.map((row) => ({
      id: String(row.id),
      vocabulary: row.vocabulary,
      slug: String(row.slug),
      labelEn: String(row.label_en),
      labelAr: String(row.label_ar),
      descriptionEn: String(row.description_en),
      descriptionAr: String(row.description_ar),
      position: Number(row.position),
      isActive: true,
      usageCount: 0,
      entityType: row.entity_kind ? String(row.entity_kind) : null,
    })),
  );
});

app.use("/api/v1/admin/*", async (context, next) => {
  if (isTestAuthBypass()) {
    context.header("X-Arcadia-Auth", "test-bypass");
    await next();
    return;
  }
  const session = await getAuthSession(context.req.raw.headers);
  const role = session?.user.role;
  if (!session || (role !== "owner" && role !== "editor")) {
    return context.json({ message: "لا يملك هذا الحساب صلاحية الإدارة." }, 403);
  }
  if (role === "editor") {
    const path = context.req.path;
    const required = path.includes("/media")
      ? ["media.manage"]
      : path.includes("/statistics") || path.includes("/overview")
        ? ["analytics.view"]
        : path.includes("/entities")
          ? ["people.edit", "studios.edit"]
          : path.includes("/accounts")
            ? ["accounts.manage"]
            : ["catalog.edit"];
    const [capability] = await database().client`
      select 1 from accounts a join account_capabilities c on c.account_id=a.id
      where a.auth_user_id=${session.user.id} and c.capability in ${database().client(required)}
      limit 1`;
    if (!capability) {
      return context.json({ message: "هذه الأداة خارج الصلاحيات المفوضة لهذا المحرّر." }, 403);
    }
  }
  await next();
});
app.get("/api/v1/admin/status", (context) =>
  context.json({ mode: "authenticated", productionAllowed: true }),
);

app.post("/api/v1/admin/media", async (context) => {
  const body = (await context.req.json()) as Record<string, unknown>;
  const parsed = adminMediaUploadSchema.safeParse({
    ...body,
    role: body.role ?? body.assetType,
  });
  if (!parsed.success) return context.json({ message: "Invalid image upload" }, 400);
  try {
    const stored = await storeMedia({
      dataUrl: parsed.data.dataUrl,
      fileName: parsed.data.fileName,
      ownerName: parsed.data.ownerName,
      assetType: parsed.data.role,
    });
    const sql = database().client;
    const [existing] = await sql`select * from media_assets where sha256=${stored.sha256}`;
    let assetId: string;
    let relativePath: string;
    let duplicate = false;
    if (existing) {
      assetId = String(existing.id);
      relativePath = String(existing.path);
      duplicate = true;
      if (relativePath !== stored.relativePath) await removeStoredMedia(stored.relativePath);
    } else {
      const [asset] = await sql`insert into media_assets
        (path, sha256, mime_type, byte_size, width, height, original_filename)
        values (${stored.relativePath}, ${stored.sha256}, ${stored.mimeType}, ${stored.byteSize}, ${stored.width}, ${stored.height}, ${stored.originalFilename}) returning id`;
      if (!asset) throw new Error("Could not register the media asset");
      assetId = String(asset.id);
      relativePath = stored.relativePath;
    }
    if (parsed.data.owner)
      await assignMediaPath(
        sql,
        relativePath,
        parsed.data.role,
        parsed.data.owner,
        parsed.data.isPrimary,
      );
    return context.json({ ...stored, id: assetId, relativePath, duplicate }, 201);
  } catch (error) {
    return context.json(
      { message: error instanceof Error ? error.message : "Image upload failed" },
      400,
    );
  }
});

app.get("/api/v1/admin/media-artwork-search", async (context) => {
  const parsed = artworkSearchQuerySchema.safeParse(context.req.query());
  if (!parsed.success) return context.json({ message: "Invalid artwork search" }, 400);
  const candidates = await searchArtwork(parsed.data);
  return context.json({ candidates });
});

app.post("/api/v1/admin/media-artwork-ingest", async (context) => {
  const parsed = adminArtworkIngestSchema.safeParse(await context.req.json());
  if (!parsed.success) return context.json({ message: "Invalid artwork selection" }, 400);
  const input = parsed.data;
  try {
    const stored = await storeMediaFromUrl({
      url: input.downloadUrl,
      assetType: input.role,
      ownerName: input.ownerName,
    });
    const sql = database().client;
    const [existing] = await sql`select * from media_assets where sha256=${stored.sha256}`;
    let assetId: string;
    let relativePath: string;
    let duplicate = false;
    if (existing) {
      assetId = String(existing.id);
      relativePath = String(existing.path);
      duplicate = true;
      if (relativePath !== stored.relativePath) await removeStoredMedia(stored.relativePath);
    } else {
      const [asset] = await sql`insert into media_assets
        (path, sha256, mime_type, byte_size, width, height, original_filename)
        values (${stored.relativePath}, ${stored.sha256}, ${stored.mimeType}, ${stored.byteSize}, ${stored.width}, ${stored.height}, ${stored.originalFilename}) returning id`;
      if (!asset) throw new Error("Could not register the media asset");
      assetId = String(asset.id);
      relativePath = stored.relativePath;
    }
    if (input.owner)
      await assignMediaPath(sql, relativePath, input.role, input.owner, input.isPrimary);
    // `tmdb`/`anilist` are catalog ids — they belong on the typed `tmdb_id`/`anilist_id` column
    // of whichever row this artwork search matched (the installment for a per-season pick, the
    // title otherwise), written in place rather than accumulating as `external_identities` rows
    // that a later title save would silently delete (see the player/torrent roadmap's Phase 0).
    // `fanart` has no typed column — it's an image id, not a catalog id — so it keeps the old
    // `external_identities` row, now scoped to either owner.
    if (input.provider === "tmdb" || input.provider === "anilist") {
      const column = input.provider === "tmdb" ? "tmdb_id" : "anilist_id";
      const numericId = Number(input.externalId);
      if (Number.isFinite(numericId)) {
        if (input.installmentId)
          await sql`update installments set ${sql(column)}=${numericId}, updated_at=now() where id=${input.installmentId}`;
        else if (input.titleId)
          await sql`update titles set ${sql(column)}=${numericId}, updated_at=now() where id=${input.titleId}`;
      }
    } else if (input.titleId || input.installmentId) {
      await sql`insert into external_identities (title_id, installment_id, provider, external_id)
        values (${input.titleId ?? null}, ${input.installmentId ?? null}, ${input.provider}, ${input.externalId})
        on conflict (title_id, installment_id, lower(btrim(provider)), external_id) do nothing`;
    }
    return context.json({ ...stored, id: assetId, relativePath, duplicate }, 201);
  } catch (error) {
    return context.json(
      { message: error instanceof Error ? error.message : "Artwork ingest failed" },
      400,
    );
  }
});

app.get("/api/v1/admin/media-assets", async (context) => {
  const parsed = adminMediaSearchSchema.safeParse(context.req.query());
  if (!parsed.success) return context.json({ message: "Invalid media search" }, 400);
  const { q, role, health, limit, offset } = parsed.data;
  const sql = database().client;
  const rows = await sql`select a.*,
    (select count(*)::int from media_asset_assignments x where x.asset_id=a.id) as usage_count
    from media_assets a
    where (${q ?? null}::text is null or a.original_filename ilike ${`%${q ?? ""}%`} or a.sha256 like ${`${q ?? ""}%`})
      and (${role ?? null}::media_asset_role is null or exists (select 1 from media_asset_assignments x where x.asset_id=a.id and x.role=${role ?? null}))
    order by a.updated_at desc limit ${limit + offset}`;
  const assets: Array<z.infer<typeof mediaAssetSchema>> = [];
  for (const row of rows) {
    const assignmentRows =
      await sql`select x.id, x.role, x.is_primary, x.title_id, x.installment_id, x.episode_id, x.entity_id,
      coalesce(t.title_ar, t.canonical_title, i.title, e.title, entity.name, 'سجل غير معروف') as owner_label
      from media_asset_assignments x
      left join titles t on t.id=x.title_id
      left join installments i on i.id=x.installment_id
      left join episodes e on e.id=x.episode_id
      left join entities entity on entity.id=x.entity_id
      where x.asset_id=${row.id} order by x.is_primary desc, owner_label`;
    const exists = await storedMediaExists(String(row.path));
    const assetHealth: z.infer<typeof mediaAssetSchema>["health"] = row.deletion_error
      ? "deletion-failed"
      : exists
        ? "healthy"
        : "missing";
    const usageCount = Number(row.usage_count);
    const matchesSpecialFilter =
      (health === "reused" && usageCount > 1) ||
      (health === "unused" && usageCount === 0) ||
      (health === "oversized" && Number(row.byte_size) > 10_000_000);
    if (health !== "all" && health !== assetHealth && !matchesSpecialFilter) continue;
    assets.push({
      id: String(row.id),
      path: String(row.path),
      sha256: String(row.sha256),
      mimeType: row.mime_type,
      byteSize: Number(row.byte_size),
      width: Number(row.width),
      height: Number(row.height),
      originalFilename: String(row.original_filename),
      focalX: Number(row.focal_x),
      focalY: Number(row.focal_y),
      usageCount,
      health: assetHealth,
      deletionError: row.deletion_error ? String(row.deletion_error) : null,
      assignments: assignmentRows.map((assignment) => ({
        id: String(assignment.id),
        role: assignment.role,
        isPrimary: Boolean(assignment.is_primary),
        owner: Object.fromEntries(
          [
            ["titleId", assignment.title_id],
            ["installmentId", assignment.installment_id],
            ["episodeId", assignment.episode_id],
            ["entityId", assignment.entity_id],
          ].filter(([, value]) => value),
        ),
        ownerLabel: String(assignment.owner_label),
      })),
    });
  }
  return context.json({ items: assets.slice(offset, offset + limit), total: assets.length });
});

app.patch("/api/v1/admin/media-assets/:assetId/focal", async (context) => {
  const parsed = z
    .object({ focalX: z.number().int().min(0).max(100), focalY: z.number().int().min(0).max(100) })
    .safeParse(await context.req.json());
  if (!parsed.success) return context.json({ message: "موضع التركيز غير صالح." }, 400);
  const [row] = await database().client`update media_assets set focal_x=${parsed.data.focalX},
    focal_y=${parsed.data.focalY},updated_at=now() where id=${context.req.param("assetId")} returning id`;
  if (!row) return context.json({ message: "الأصل غير موجود." }, 404);
  return context.json({ updated: true });
});

app.post("/api/v1/admin/media-assignments", async (context) => {
  const parsed = adminMediaAssignmentSchema.safeParse(await context.req.json());
  if (!parsed.success)
    return context.json({ message: "Invalid media assignment", issues: parsed.error.issues }, 400);
  const sql = database().client;
  const [asset] = await sql`select path from media_assets where id=${parsed.data.assetId}`;
  if (!asset) return context.json({ message: "Media asset not found" }, 404);
  await assignMediaPath(
    sql,
    String(asset.path),
    parsed.data.role,
    parsed.data.owner,
    parsed.data.isPrimary,
  );
  return context.json({ assigned: true });
});

app.delete("/api/v1/admin/media-assignments/:assignmentId", async (context) => {
  const assignmentId = z.string().uuid().safeParse(context.req.param("assignmentId"));
  if (!assignmentId.success) return context.json({ message: "Invalid assignment id" }, 400);
  const sql = database().client;
  const [row] = await sql`delete from media_asset_assignments x using media_assets a
    where x.id=${assignmentId.data} and a.id=x.asset_id returning a.path`;
  if (!row) return context.json({ message: "Media assignment not found" }, 404);
  await purgeUnreferencedMedia([String(row.path)]);
  return context.json({ deleted: true });
});

app.delete("/api/v1/admin/media-assets/:assetId", async (context) => {
  const assetId = z.string().uuid().safeParse(context.req.param("assetId"));
  if (!assetId.success) return context.json({ message: "Invalid asset id" }, 400);
  const sql = database().client;
  const [asset] = await sql`select a.path, count(x.id)::int as usage_count from media_assets a
    left join media_asset_assignments x on x.asset_id=a.id where a.id=${assetId.data} group by a.id`;
  if (!asset) return context.json({ message: "Media asset not found" }, 404);
  if (Number(asset.usage_count))
    return context.json({ message: "Remove every assignment before deleting this asset" }, 409);
  try {
    await removeStoredMedia(String(asset.path));
    await sql`delete from media_assets where id=${assetId.data}`;
    return context.json({ deleted: true });
  } catch (error) {
    await sql`update media_assets set deletion_error=${error instanceof Error ? error.message : "File deletion failed"} where id=${assetId.data}`;
    return context.json({ message: "The database row was kept because file deletion failed" }, 500);
  }
});

app.post("/api/v1/admin/titles/:titleId/materialize-media", async (context) => {
  const titleId = context.req.param("titleId");
  const sql = database().client;
  const [title] = await sql`select canonical_title from titles where id=${titleId}`;
  if (!title) return context.json({ message: "Title not found" }, 404);

  const converted = 0;
  return context.json({ titleId, converted });
});

app.get("/api/v1/admin/overview", async (context) => {
  const sql = database().client;
  const [metrics] = await sql`
    select
      (select count(*)::int from titles) as titles,
      (select count(*)::int from titles where is_private) as private_titles,
      (select count(*)::int from titles where title_ar is null or btrim(title_ar)='') as missing_arabic,
      (select count(*)::int from titles t where not exists (select 1 from media_asset_assignments x where x.title_id=t.id and x.role='poster' and x.is_primary)) as missing_posters,
      (select count(*)::int from media_assets) as media_assets,
      (select count(*)::int from media_assets a where a.deletion_error is not null) as media_failures,
      (select count(*)::int from media_assets a where not exists (select 1 from media_asset_assignments x where x.asset_id=a.id)) as unreferenced_assets,
      (select count(*)::int from (select asset_id from media_asset_assignments group by asset_id having count(*) > 1) reused) as reused_assets,
      (select count(*)::int from genres g where not g.is_active and exists (select 1 from title_genres x where x.value_id=g.id))
       + (select count(*)::int from tones g where not g.is_active and exists (select 1 from title_tones x where x.value_id=g.id))
       + (select count(*)::int from tags g where not g.is_active and exists (select 1 from title_tags x where x.value_id=g.id)) as inactive_term_usage,
      (select count(*)::int from titles where coalesce(btrim(content_warnings),'')='' or coalesce(btrim(analysis_notes),'')='') as missing_guidance,
      (select count(*)::int from installments) as installments,
      (select count(*)::int from installments where kind='season') as seasons,
      (select count(*)::int from installments where kind='movie') as movies,
      (select count(*)::int from installments where kind='special') as specials,
      (select count(*)::int from installments where release_date is null) as missing_release_dates,
      (select count(*)::int from episodes) as episodes,
      (select count(*)::int from installment_scores where story is not null and characters is not null and depth is not null and world_building is not null and originality is not null and craft is not null) as scored_installments,
      (select count(*)::int from entities where kind='person') as people,
      (select count(*)::int from entities where kind='organization') as studios,
      (select count(*)::int from planets where is_active) as planets,
      (select count(*)::int from titles t where not exists (select 1 from title_planets tp where tp.title_id=t.id)) as unassigned_titles,
      (select count(*)::int from contributions) as credits,
      (select count(*)::int from title_relations) as relationships`;
  return context.json(metrics);
});

const vocabularyUsage = {
  genres: "title_genres",
  tones: "title_tones",
  tags: "title_tags",
  countries: "title_countries",
  roles: "contributions",
} as const;
const controlledVocabularies = new Set(["audiences", "ages", "risk-levels", "release-statuses"]);

app.get("/api/v1/admin/vocabularies", async (context) => {
  const requested = context.req.query("vocabulary");
  const parsed = requested ? vocabularyNameSchema.safeParse(requested) : null;
  if (parsed && !parsed.success) return context.json({ message: "Unknown vocabulary" }, 400);
  const sql = database().client;
  const names = parsed?.success ? [parsed.data] : vocabularyNameSchema.options;
  const terms: Array<z.infer<typeof vocabularyTermSchema>> = [];
  for (const vocabulary of names) {
    if (controlledVocabularies.has(vocabulary)) {
      const rows = await sql`select v.*,
        case v.vocabulary
          when 'audiences' then (select count(*)::int from titles where audience::text=v.value) + (select count(*)::int from installments where audience_override::text=v.value)
          when 'ages' then (select count(*)::int from titles where age::text=v.value) + (select count(*)::int from installments where age_override::text=v.value)
          when 'risk-levels' then (select count(*)::int from titles where sexuality_risk::text=v.value or behavioral_risk::text=v.value or theology_risk::text=v.value)
          when 'release-statuses' then (select count(*)::int from installments where status::text=v.value)
          else 0 end as usage_count
        from vocabulary_labels v where v.vocabulary=${vocabulary} order by v.position`;
      terms.push(
        ...rows.map((row) => ({
          id: `${vocabulary}:${row.value}`,
          vocabulary,
          slug: String(row.value),
          labelEn: String(row.label_en),
          labelAr: String(row.label_ar),
          descriptionEn: String(row.description_en),
          descriptionAr: String(row.description_ar),
          position: Number(row.position),
          isActive: Boolean(row.is_active),
          usageCount: Number(row.usage_count),
          entityType: null,
        })),
      );
      continue;
    }
    const lookupVocabulary = vocabulary as keyof typeof vocabularyUsage;
    const usageTable = vocabularyUsage[lookupVocabulary];
    const usageColumn = lookupVocabulary === "roles" ? "role_id" : "value_id";
    const rows = await sql`select v.id, v.slug, v.label_en, v.label_ar, v.description_en,
      v.description_ar, v.position, v.is_active,
      ${lookupVocabulary === "roles" ? sql`v.entity_kind` : sql`null::entity_kind`} as entity_kind,
      (select count(*)::int from ${sql(usageTable)} x where x.${sql(usageColumn)}=v.id) as usage_count
      from ${sql(vocabulary)} v order by v.position, v.label_en`;
    terms.push(
      ...rows.map((row) => ({
        id: String(row.id),
        vocabulary,
        slug: String(row.slug),
        labelEn: String(row.label_en),
        labelAr: String(row.label_ar),
        descriptionEn: String(row.description_en),
        descriptionAr: String(row.description_ar),
        position: Number(row.position),
        isActive: Boolean(row.is_active),
        usageCount: Number(row.usage_count),
        entityType: row.entity_kind ? String(row.entity_kind) : null,
      })),
    );
  }
  return context.json(z.array(vocabularyTermSchema).parse(terms));
});

app.post("/api/v1/admin/vocabularies", async (context) => {
  const parsed = adminVocabularyInputSchema.safeParse(await context.req.json());
  if (!parsed.success)
    return context.json({ message: "Invalid vocabulary term", issues: parsed.error.issues }, 400);
  const value = parsed.data;
  const sql = database().client;
  if (value.vocabulary === "roles") {
    if (!value.id || !value.entityType || !contributionRoleSlugs.has(value.slug))
      return context.json({ message: "Contribution roles are a fixed, typed vocabulary" }, 409);
    const [current] = await sql`select slug, entity_kind from roles where id=${value.id}`;
    if (!current) return context.json({ message: "Vocabulary term not found" }, 404);
    if (current.slug !== value.slug || current.entity_kind !== value.entityType)
      return context.json({ message: "A role's code and entity type cannot be changed" }, 409);
    await sql`update roles set label_en=${value.labelEn}, label_ar=${value.labelAr},
      description_en=${value.descriptionEn}, description_ar=${value.descriptionAr}, position=${value.position},
      is_active=${value.isActive} where id=${value.id}`;
    return context.json({ id: value.id });
  }
  if (controlledVocabularies.has(value.vocabulary)) {
    if (!value.id) return context.json({ message: "Controlled values cannot be created" }, 409);
    const currentValue = value.id.slice(value.vocabulary.length + 1);
    if (currentValue !== value.slug)
      return context.json({ message: "Controlled values cannot be renamed" }, 409);
    const [row] =
      await sql`update vocabulary_labels set label_en=${value.labelEn}, label_ar=${value.labelAr},
      description_en=${value.descriptionEn}, description_ar=${value.descriptionAr}, position=${value.position},
      is_active=${value.isActive} where vocabulary=${value.vocabulary} and value=${value.slug} returning value`;
    return row
      ? context.json({ id: value.id })
      : context.json({ message: "Vocabulary value not found" }, 404);
  }
  if (value.id) {
    const usageTable = vocabularyUsage[value.vocabulary as keyof typeof vocabularyUsage];
    const usageColumn = "value_id";
    const [current] = await sql`select v.slug,
      exists(select 1 from ${sql(usageTable)} x where x.${sql(usageColumn)}=v.id) as used
      from ${sql(value.vocabulary)} v where v.id=${value.id}`;
    if (!current) return context.json({ message: "Vocabulary term not found" }, 404);
    if (current.used && current.slug !== value.slug)
      return context.json({ message: "A used slug requires an explicit data migration" }, 409);
    await sql`update ${sql(value.vocabulary)} set slug=${value.slug}, label_en=${value.labelEn},
      label_ar=${value.labelAr}, description_en=${value.descriptionEn}, description_ar=${value.descriptionAr},
      position=${value.position}, is_active=${value.isActive} where id=${value.id}`;
    return context.json({ id: value.id });
  }
  const [row] = await sql`insert into ${sql(value.vocabulary)}
    (slug, label_en, label_ar, description_en, description_ar, position, is_active)
    values (${value.slug}, ${value.labelEn}, ${value.labelAr}, ${value.descriptionEn}, ${value.descriptionAr}, ${value.position}, ${value.isActive}) returning id`;
  return context.json({ id: String(row?.id) }, 201);
});

app.delete("/api/v1/admin/vocabularies/:vocabulary/:termId", async (context) => {
  const vocabulary = vocabularyNameSchema.safeParse(context.req.param("vocabulary"));
  const termId = z.string().min(1).safeParse(context.req.param("termId"));
  if (!vocabulary.success || !termId.success)
    return context.json({ message: "Invalid vocabulary term" }, 400);
  const sql = database().client;
  if (controlledVocabularies.has(vocabulary.data))
    return context.json({ message: "Controlled values can be archived but not deleted" }, 409);
  if (vocabulary.data === "roles")
    return context.json({ message: "Contribution roles are a fixed vocabulary" }, 409);
  const usageTable = vocabularyUsage[vocabulary.data as keyof typeof vocabularyUsage];
  const usageColumn = "value_id";
  const [usage] =
    await sql`select count(*)::int as count from ${sql(usageTable)} where ${sql(usageColumn)}=${termId.data}`;
  if (Number(usage?.count))
    return context.json({ message: "Archive terms that are still in use" }, 409);
  const result = await sql`delete from ${sql(vocabulary.data)} where id=${termId.data}`;
  return context.json({ deleted: result.count });
});

app.get("/api/v1/admin/validation", async (context) => {
  const sql = database().client;
  const issues: Array<z.infer<typeof validationIssueSchema>> = [];
  const metadata = await sql`select id, canonical_title, title_ar, summary from titles
    where title_ar is null or btrim(title_ar)='' or btrim(summary)=''`;
  for (const row of metadata)
    issues.push({
      id: `metadata:${row.id}`,
      severity: "warning",
      category: "metadata",
      entityType: "work",
      entityId: String(row.id),
      title: String(row.canonical_title),
      path: "title.metadata",
      message: !row.title_ar ? "العنوان العربي مفقود." : "الملخص مفقود.",
      action: "راجع الحقول التحريرية.",
      repairPath: `/admin/catalog/${row.id}`,
      autoRepairable: false,
    });
  const missingPosters = await sql`select id, canonical_title from titles t where not exists
    (select 1 from media_asset_assignments x where x.title_id=t.id and x.role='poster' and x.is_primary)`;
  for (const row of missingPosters)
    issues.push({
      id: `poster:${row.id}`,
      severity: "warning",
      category: "media",
      entityType: "work",
      entityId: String(row.id),
      title: String(row.canonical_title),
      path: "media.poster",
      message: "لا يوجد ملصق أساسي.",
      action: "اختر أصلاً موجوداً أو ارفع صورة.",
      repairPath: `/admin/catalog/${row.id}`,
      autoRepairable: false,
    });
  const orphanAssets =
    await sql`select id, path, deletion_error from media_assets a where not exists
    (select 1 from media_asset_assignments x where x.asset_id=a.id)`;
  for (const row of orphanAssets)
    issues.push({
      id: `asset-orphan:${row.id}`,
      severity: row.deletion_error ? "error" : "info",
      category: "media",
      entityType: "asset",
      entityId: String(row.id),
      title: String(row.path),
      path: "media.assignments",
      message: row.deletion_error ? String(row.deletion_error) : "ملف غير مستخدم.",
      action: "يمكن حذف الأصل غير المستخدم بأمان.",
      repairPath: "/admin/media",
      autoRepairable: !row.deletion_error,
    });
  const allAssets = await sql`select id, path from media_assets`;
  for (const row of allAssets)
    if (!(await storedMediaExists(String(row.path))))
      issues.push({
        id: `asset-missing:${row.id}`,
        severity: "error",
        category: "media",
        entityType: "asset",
        entityId: String(row.id),
        title: String(row.path),
        path: "media.file",
        message: "سجل الأصل موجود لكن الملف غير موجود على القرص.",
        action: "استبدل الملف أو احذف التعيينات بعد المراجعة.",
        repairPath: "/admin/media?health=missing",
        autoRepairable: false,
      });
  const inactiveTerms = await sql`
    select 'genres' as vocabulary, g.id, g.label_ar, count(x.title_id)::int as usage from genres g join title_genres x on x.value_id=g.id where not g.is_active group by g.id
    union all select 'tones', g.id, g.label_ar, count(x.title_id)::int from tones g join title_tones x on x.value_id=g.id where not g.is_active group by g.id
    union all select 'tags', g.id, g.label_ar, count(x.title_id)::int from tags g join title_tags x on x.value_id=g.id where not g.is_active group by g.id`;
  for (const row of inactiveTerms)
    issues.push({
      id: `inactive:${row.vocabulary}:${row.id}`,
      severity: "warning",
      category: "vocabulary",
      entityType: "vocabulary",
      entityId: String(row.id),
      title: String(row.label_ar),
      path: `${row.vocabulary}.isActive`,
      message: `مصطلح مؤرشف ما زال مستخدماً في ${row.usage} سجل.`,
      action: "استبدل المصطلح أو أعد تنشيطه.",
      repairPath: `/admin/vocabularies?vocabulary=${row.vocabulary}`,
      autoRepairable: false,
    });
  return context.json(z.array(validationIssueSchema).parse(issues));
});

app.get("/api/v1/admin/statistics", async (context) => {
  const visibility = context.req.query("visibility") ?? "all";
  if (!(["all", "public", "private"] as const).includes(visibility as never))
    return context.json({ message: "Invalid visibility filter" }, 400);
  const sql = database().client;
  const include = visibility === "all" ? null : visibility === "private";
  const titleFilter = sql`(${include}::boolean is null or t.is_private=${include})`;
  const [
    visibilityRows,
    kindRows,
    timeline,
    statuses,
    genreRows,
    tagRows,
    toneRows,
    countryRows,
    planetRows,
    scoreRows,
    coverageRows,
    assetTotals,
    mediaRoles,
    mediaFormats,
    contributorRows,
  ] = await Promise.all([
    sql`select case when is_private then 'private' else 'public' end as key, count(*)::int as value from titles group by is_private`,
    sql`select case when exists(select 1 from installments i where i.title_id=t.id and i.kind='season') then 'anime' else 'movie' end as key, count(*)::int as value from titles t where ${titleFilter} group by key`,
    sql`select release_year::int as year, count(*)::int as value from titles t where release_year is not null and ${titleFilter} group by release_year order by release_year`,
    sql`select i.status as key, count(*)::int as value from installments i join titles t on t.id=i.title_id where ${titleFilter} group by i.status`,
    sql`select v.slug as key, v.label_ar, count(*)::int as value from title_genres x join genres v on v.id=x.value_id join titles t on t.id=x.title_id where ${titleFilter} group by v.id order by value desc limit 12`,
    sql`select v.slug as key, v.label_ar, count(*)::int as value from title_tags x join tags v on v.id=x.value_id join titles t on t.id=x.title_id where ${titleFilter} group by v.id order by value desc limit 12`,
    sql`select v.slug as key, v.label_ar, count(*)::int as value from title_tones x join tones v on v.id=x.value_id join titles t on t.id=x.title_id where ${titleFilter} group by v.id order by value desc limit 12`,
    sql`select v.slug as key, v.label_ar, count(*)::int as value from title_countries x join countries v on v.id=x.value_id join titles t on t.id=x.title_id where ${titleFilter} group by v.id order by value desc limit 12`,
    sql`select p.slug as key, p.name_ar as label_ar, count(*)::int as value from title_planets x join planets p on p.id=x.planet_id join titles t on t.id=x.title_id where ${titleFilter} group by p.id order by value desc`,
    sql`select (floor((story+characters+depth+world_building+originality+craft)/6))::int as bucket, count(*)::int as value from installment_scores s join installments i on i.id=s.installment_id join titles t on t.id=i.title_id where ${titleFilter} and num_nonnulls(story,characters,depth,world_building,originality,craft)=6 group by bucket order by bucket`,
    sql`select count(*) filter (where num_nonnulls(s.story,s.characters,s.depth,s.world_building,s.originality,s.craft)=6)::int as scored, count(*)::int as total from installments i join titles t on t.id=i.title_id left join installment_scores s on s.installment_id=i.id where ${titleFilter}`,
    sql`select count(*)::int as assets, coalesce(sum(byte_size),0)::int as bytes, count(*) filter (where (select count(*) from media_asset_assignments x where x.asset_id=a.id)>1)::int as reused from media_assets a`,
    sql`select role as key, count(*)::int as value from media_asset_assignments group by role`,
    sql`select mime_type as key, count(*)::int as value from media_assets group by mime_type`,
    sql`select r.slug as key, r.label_ar, count(*)::int as value from contributions c join roles r on r.id=c.role_id join titles t on t.id=c.title_id where ${titleFilter} group by r.id order by value desc limit 12`,
  ]);
  const pairs = (rows: typeof visibilityRows) =>
    rows.map((row) => ({ key: String(row.key), value: Number(row.value) }));
  const ranked = (rows: typeof genreRows) =>
    rows.map((row) => ({
      key: String(row.key),
      labelAr: String(row.label_ar),
      value: Number(row.value),
    }));
  const totals = assetTotals[0];
  const coverage = coverageRows[0];
  const payload = {
    visibility: pairs(visibilityRows),
    kinds: pairs(kindRows),
    releaseTimeline: timeline.map((row) => ({ year: Number(row.year), value: Number(row.value) })),
    installmentStatus: pairs(statuses),
    genres: ranked(genreRows),
    tags: ranked(tagRows),
    tones: ranked(toneRows),
    countries: ranked(countryRows),
    planets: ranked(planetRows),
    scoreDistribution: scoreRows.map((row) => ({
      bucket: `${row.bucket}–${Number(row.bucket) + 1}`,
      value: Number(row.value),
    })),
    scoreCoverage: { scored: Number(coverage?.scored ?? 0), total: Number(coverage?.total ?? 0) },
    media: {
      assets: Number(totals?.assets ?? 0),
      bytes: Number(totals?.bytes ?? 0),
      reused: Number(totals?.reused ?? 0),
      roles: pairs(mediaRoles),
      formats: pairs(mediaFormats),
    },
    contributors: ranked(contributorRows),
  };
  return context.json(adminStatisticsSchema.parse(payload));
});

app.get("/api/v1/admin/titles", async (context) => {
  const mode = context.req.query("mode") === "installments" ? "installments" : "titles";
  return context.json(
    await browse(
      {
        q: context.req.query("q") || undefined,
        mode,
        sort: "title",
        limit: Math.min(Number(context.req.query("limit") || 100), 100),
        offset: Number(context.req.query("offset") || 0),
      },
      true,
    ),
  );
});

app.get("/api/v1/admin/titles/:titleId", async (context) => {
  const detail = await titleDetail(context.req.param("titleId"), true);
  return detail ? context.json(detail) : context.json({ message: "Title not found" }, 404);
});

async function recordTitleRevision(
  headers: Headers,
  titleId: string,
  input: LegacyTitleRoutePayload,
) {
  const current = await currentFamilyAccount(headers);
  const [next] = await database().client`select coalesce(max(revision),0)+1 as revision
    from editorial_revisions where entity_type='title' and entity_id=${titleId}`;
  await database().client`insert into editorial_revisions
    (actor_account_id,entity_type,entity_id,revision,action,summary,snapshot,changes)
    values (${current?.account.id ?? null},'title',${titleId},${Number(next?.revision ?? 1)},
      'save',${`حفظ نسخة تحريرية للعمل ${String(input.arabicTitle ?? input.title ?? titleId)}`},
      ${JSON.stringify(input)}::jsonb,'{}'::jsonb)`;
}

app.post("/api/v1/admin/titles", async (context) => {
  const raw = (await context.req.json()) as LegacyTitleRoutePayload;
  const sql = database().client;
  const titleText = String(raw.title ?? raw.canonicalTitle ?? "").trim();
  if (!titleText) return context.json({ message: "Title is required" }, 400);
  const contributorError = await contributionValidationError(sql, raw.contributors);
  if (contributorError) return context.json({ message: contributorError }, 400);

  const imagePath = await materializeEmbeddedMedia(raw.imagePath, titleText, "poster");
  const bannerPath = await materializeEmbeddedMedia(raw.bannerPath, titleText, "banner");
  const logoPath = await materializeEmbeddedMedia(raw.logoPath, titleText, "logo");

  let preserved = defaultPreservedTitleFields;
  if (raw.id) {
    const [row] = await sql`select age, quality_score, curator_notes, provenance,
      workflow_status, verified_at, verified_by_account_id from titles where id=${raw.id}`;
    if (!row) return context.json({ message: "Title not found" }, 404);
    preserved = {
      age: row.age,
      qualityScore: Number(row.quality_score),
      curatorNotes: String(row.curator_notes),
      provenance: row.provenance as Record<string, unknown>,
      workflowStatus: row.workflow_status,
      verifiedAt: row.verified_at ? new Date(row.verified_at).toISOString() : null,
      verifiedByAccountId: row.verified_by_account_id ? String(row.verified_by_account_id) : null,
    };
  }

  const parsed = parseLegacyTitleInput(
    { ...raw, title: titleText, imagePath, bannerPath, logoPath },
    preserved,
  );
  if (!parsed.success)
    return context.json({ message: "بيانات العمل غير صالحة.", issues: parsed.error.issues }, 400);

  const current = await currentFamilyAccount(context.req.raw.headers);
  let result: { id: string };
  try {
    result = await applyTitleWrite(sql, raw.id ? String(raw.id) : null, parsed.data, {
      actorAccountId: current?.account.id ?? null,
      previous: {
        verifiedAt: preserved.verifiedAt,
        verifiedByAccountId: preserved.verifiedByAccountId,
      },
    });
  } catch (error) {
    if (error instanceof TitleWriteError)
      return context.json({ message: error.message }, raw.id ? 404 : 500);
    throw error;
  }

  if (raw.id) {
    await sql`update installments set title=${titleText}, summary=${String(raw.summary ?? "")},
      runtime_minutes=${raw.runtimeMinutes ?? null},
      status=${initialInstallmentStatus(raw.releaseStatus)}, updated_at=now()
      where title_id=${result.id}
        and (select count(*) from installments where title_id=${result.id})=1`;
  } else {
    const kind = ["series", "anime"].includes(String(raw.kind)) ? "season" : "movie";
    await sql`insert into installments
      (title_id, kind, position, title, summary, status, runtime_minutes)
      values (${result.id}, ${kind}, 1, ${titleText}, ${String(raw.summary ?? "")},
        ${initialInstallmentStatus(raw.releaseStatus)}, ${raw.runtimeMinutes ?? null})`;
  }
  await assignMediaPath(sql, imagePath, "poster", { titleId: result.id });
  await assignMediaPath(sql, bannerPath, "banner", { titleId: result.id });
  await assignMediaPath(sql, logoPath, "logo", { titleId: result.id });

  // Award recognitions are no longer part of a title's own save payload (Stage 2) — they're
  // written exclusively through /api/v1/admin/awards/recognitions now, immediately, one at a
  // time, by the title editor's Awards tab and the standalone awards page alike.

  await recordTitleRevision(context.req.raw.headers, result.id, raw);
  return context.json({ id: result.id }, raw.id ? 200 : 201);
});

app.delete("/api/v1/admin/titles", async (context) => {
  const { ids = [] } = (await context.req.json()) as { ids?: string[] };
  if (!ids.length) return context.json({ deleted: 0 });
  const sql = database().client;
  const previousMedia =
    await sql`select distinct ma.path from media_asset_assignments x join media_assets ma on ma.id=x.asset_id
    where x.title_id in ${sql(ids)} or x.installment_id in (select id from installments where title_id in ${sql(ids)})`;
  const result = await sql`delete from titles where id in ${sql(ids)}`;
  await purgeUnreferencedMedia(previousMedia.map((row) => row.path as string | null));
  return context.json({ deleted: result.count });
});

app.put("/api/v1/admin/titles/:titleId/structure", async (context) => {
  const titleId = context.req.param("titleId");
  const parsed = adminStructureSchema.safeParse(await context.req.json());
  if (!parsed.success)
    return context.json(
      { message: "Invalid v2 installment document", issues: parsed.error.issues },
      400,
    );
  const input = parsed.data as {
    seasons: AdminStructureSeason[];
    ungroupedUnits: AdminStructureUnit[];
  };
  const sql = database().client;
  const [ownerTitle] = await sql`select canonical_title from titles where id=${titleId}`;
  if (!ownerTitle) return context.json({ message: "Title not found" }, 404);
  const previousMedia =
    await sql`select ma.path from media_asset_assignments x join media_assets ma on ma.id=x.asset_id
    where x.installment_id in (select id from installments where title_id=${titleId})`;
  await sql.begin(async (transaction) => {
    const preservedScoreRows =
      await transaction`select i.id, s.story, s.characters, s.depth, s.world_building, s.originality, s.craft from installments i join installment_scores s on s.installment_id=i.id where i.title_id=${titleId}`;
    const preservedScores = new Map(preservedScoreRows.map((score) => [String(score.id), score]));
    // Same rebuild-loses-it hazard as scores/awards below: the structure document doesn't always
    // carry the five typed ids (e.g. the JSON structure editor's older documents, or a caller
    // that only touches episodes) — fall back to what the installment already had rather than
    // silently clearing an ingested/entered id on an unrelated structure save.
    const preservedIdRows =
      await transaction`select id, tmdb_id, imdb_id, tvdb_id, anilist_id, mal_id from installments where title_id=${titleId}`;
    const preservedIds = new Map(preservedIdRows.map((row) => [String(row.id), row]));
    // award_recognitions.installment_id cascades on installment delete, so rebuilding the
    // installment list below would otherwise silently drop any award tied to one — read them out
    // first, keyed by their (soon-to-be-deleted) installment id, and reinsert once the matching
    // installment exists again under its new id.
    const preservedAwardRows =
      await transaction`select installment_id, organization_id, category_id, ceremony_id, organization_slug, organization_name, category, year, result, is_featured, source_url, notes, position from award_recognitions where installment_id in (select id from installments where title_id=${titleId})`;
    const preservedAwards = new Map<string, (typeof preservedAwardRows)[number][]>();
    for (const award of preservedAwardRows) {
      const key = String(award.installment_id);
      preservedAwards.set(key, [...(preservedAwards.get(key) ?? []), award]);
    }
    await transaction`delete from installments where title_id=${titleId}`;
    for (const [index, season] of (input.seasons ?? []).entries()) {
      const units = season.units ?? [];
      const kind = season.installmentKind ?? (units.length ? "season" : "movie");
      const installmentTitle = String(season.title ?? `Installment ${index + 1}`);
      const posterPath = await materializeEmbeddedMedia(
        season.posterPath,
        `${String(ownerTitle.canonical_title)} ${kind} ${Number(season.position ?? index) + 1} ${installmentTitle}`,
        "poster",
      );
      const preservedId = season.id ? preservedIds.get(season.id) : undefined;
      const [installment] = await transaction`
        insert into installments (title_id, kind, position, title, summary, release_date, runtime_minutes, status,
          tmdb_id, imdb_id, tvdb_id, anilist_id, mal_id)
        values (${titleId}, ${kind}, ${Number(season.position ?? index + 1)}, ${installmentTitle},
          ${String(season.summary ?? "")}, ${season.releaseAt ? new Date(Number(season.releaseAt)).toISOString().slice(0, 10) : null}, ${season.runtimeMinutes ?? null}, ${season.releaseStatus ?? "unknown"},
          ${season.tmdbId !== undefined ? season.tmdbId : (preservedId?.tmdb_id ?? null)},
          ${season.imdbId !== undefined ? season.imdbId : (preservedId?.imdb_id ?? null)},
          ${season.tvdbId !== undefined ? season.tvdbId : (preservedId?.tvdb_id ?? null)},
          ${season.anilistId !== undefined ? season.anilistId : (preservedId?.anilist_id ?? null)},
          ${season.malId !== undefined ? season.malId : (preservedId?.mal_id ?? null)}) returning id`;
      if (!installment) throw new Error("Could not create installment");
      await assignMediaPath(transaction as unknown as typeof sql, posterPath, "poster", {
        installmentId: String(installment.id),
      });
      const preservedScore = season.id ? preservedScores.get(season.id) : undefined;
      const requestedScore = season.score;
      if (requestedScore || preservedScore)
        await transaction`insert into installment_scores (installment_id, story, characters, depth, world_building, originality, craft) values (${installment.id}, ${requestedScore?.story ?? preservedScore?.story ?? null}, ${requestedScore?.characters ?? preservedScore?.characters ?? null}, ${requestedScore?.depth ?? preservedScore?.depth ?? null}, ${requestedScore?.worldBuilding ?? preservedScore?.world_building ?? null}, ${requestedScore?.originality ?? preservedScore?.originality ?? null}, ${requestedScore?.craft ?? preservedScore?.craft ?? null})`;
      for (const award of season.id ? (preservedAwards.get(season.id) ?? []) : [])
        await transaction`insert into award_recognitions
          (title_id, installment_id, organization_id, category_id, ceremony_id, organization_slug,
           organization_name, category, year, result, is_featured, source_url, notes, position)
          values (${titleId}, ${installment.id}, ${award.organization_id}, ${award.category_id},
            ${award.ceremony_id}, ${award.organization_slug}, ${award.organization_name},
            ${award.category}, ${award.year}, ${award.result}, ${award.is_featured},
            ${award.source_url}, ${award.notes}, ${award.position})`;
      for (const [unitIndex, unit] of units.entries())
        await transaction`
        insert into episodes (installment_id, number, position, title, summary, release_date, runtime_minutes)
        values (${installment.id}, ${unit.unitNumber ?? unitIndex + 1}, ${Number(unit.position ?? unitIndex + 1)}, ${unit.title ?? null},
          ${unit.summary ?? ""},
          ${unit.releaseAt ? new Date(Number(unit.releaseAt)).toISOString().slice(0, 10) : null}, ${unit.runtimeMinutes ?? null})`;
    }
    if (!(input.seasons ?? []).length) {
      const [installment] = await transaction`
        insert into installments (title_id, kind, position, title, status)
        select id, 'season', 1, canonical_title, 'unknown' from titles where id=${titleId} returning id`;
      if (!installment) throw new Error("Title not found");
      for (const [index, unit] of (input.ungroupedUnits ?? []).entries())
        await transaction`
        insert into episodes (installment_id, number, position, title, summary, runtime_minutes)
        values (${installment.id}, ${unit.unitNumber ?? index + 1}, ${Number(unit.position ?? index + 1)}, ${unit.title ?? null}, ${unit.summary ?? ""}, ${unit.runtimeMinutes ?? null})`;
    }
  });
  await purgeUnreferencedMedia(previousMedia.map((row) => row.path as string));
  return context.json({ titleId });
});

app.get("/api/v1/admin/entities", async (context) => {
  const kind = context.req.query("kind");
  if (kind && kind !== "person" && kind !== "organization")
    return context.json({ message: "Invalid entity kind" }, 400);
  const sql = database().client;
  const rows = await sql`select e.id, e.name, e.sort_name as "sortName", e.kind as "entityType",
    e.description,
    (select ma.path from media_asset_assignments x join media_assets ma on ma.id=x.asset_id
      where x.entity_id=e.id and x.role='profile' and x.is_primary limit 1) as "imagePath",
    coalesce((select json_agg(a.alias order by a.alias) from entity_aliases a where a.entity_id=e.id), '[]'::json) as aliases,
    coalesce((select json_agg(work order by work.title) from (
      select t.id, t.canonical_title as title, t.title_ar as "arabicTitle",
        t.release_year as year, t.is_private as "isPrivate",
        case when exists(select 1 from installments i where i.title_id=t.id and i.kind='season') then 'anime' else 'movie' end as kind,
        case
          when not exists(select 1 from installments i where i.title_id=t.id) or exists(select 1 from installments i where i.title_id=t.id and i.status='unknown') then 'unknown'
          when exists(select 1 from installments i where i.title_id=t.id and i.status='airing') then 'airing'
          when not exists(select 1 from installments i where i.title_id=t.id and i.status<>'announced') then 'upcoming'
          when exists(select 1 from installments i where i.title_id=t.id and i.status='announced') and exists(select 1 from installments i where i.title_id=t.id and i.status='completed') then 'returning'
          when not exists(select 1 from installments i where i.title_id=t.id and i.status<>'completed') then 'completed'
          else 'unknown'
        end as "releaseStatus",
        (select ma.path from media_asset_assignments x join media_assets ma on ma.id=x.asset_id
          where x.title_id=t.id and x.role='poster' and x.is_primary limit 1) as "imagePath",
        coalesce((select json_agg(json_build_object(
          'role', r.slug, 'roleLabelAr', r.label_ar, 'position', c.position,
          'isPrimary', c.is_primary) order by c.position, r.position)
          from contributions c join roles r on r.id=c.role_id
          where c.entity_id=e.id and c.title_id=t.id), '[]'::json) as contributions
      from titles t where exists(
        select 1 from contributions c where c.entity_id=e.id and c.title_id=t.id)
    ) work), '[]'::json) as works
    from entities e where (${kind ?? null}::entity_kind is null or e.kind=${kind ?? null})
    order by e.sort_name`;
  return context.json(
    z.array(adminEntitySchema).parse(
      rows.map((row) => ({
        ...row,
        workCount: Array.isArray(row.works) ? row.works.length : 0,
      })),
    ),
  );
});

app.post("/api/v1/admin/entities", async (context) => {
  const parsed = adminEntityInputSchema.safeParse(await context.req.json());
  if (!parsed.success)
    return context.json({ message: "Invalid entity document", issues: parsed.error.issues }, 400);
  const input = parsed.data;
  const sql = database().client;
  const imagePath = await materializeEmbeddedMedia(input.imagePath, input.name, "profile");
  const savedId = await sql.begin(async (transaction) => {
    const entityId = input.id
      ? String(input.id)
      : String(
          (
            await transaction`insert into entities (name, sort_name, kind, description)
              values (${input.name}, ${input.sortName}, ${input.entityType}, ${input.description})
              returning id`
          )[0]?.id ?? "",
        );
    if (!entityId) throw new Error("Could not create entity");
    if (input.id) {
      const [updated] = await transaction`update entities set name=${input.name},
        sort_name=${input.sortName}, kind=${input.entityType}, description=${input.description},
        updated_at=now() where id=${entityId} returning id`;
      if (!updated) throw new Error("Entity not found");
    }
    await transaction`delete from entity_aliases where entity_id=${entityId}`;
    const aliases = [...new Set(input.aliases.map((alias) => alias.trim()).filter(Boolean))];
    for (const alias of aliases)
      await transaction`insert into entity_aliases (entity_id, alias) values (${entityId}, ${alias})`;
    await assignMediaPath(transaction as unknown as typeof sql, imagePath, "profile", {
      entityId,
    });
    return entityId;
  });
  return context.json({ id: savedId }, input.id ? 200 : 201);
});

app.put("/api/v1/admin/entities/:entityId/contributions", async (context) => {
  const parsed = adminEntityContributionInputSchema.safeParse(await context.req.json());
  if (!parsed.success)
    return context.json({ message: "Invalid contribution", issues: parsed.error.issues }, 400);
  const entityId = context.req.param("entityId");
  const input = parsed.data;
  const sql = database().client;
  const [compatible] = await sql`select r.id from roles r join entities e on e.kind=r.entity_kind
    where e.id=${entityId} and r.slug=${input.role} and r.is_active`;
  if (!compatible) return context.json({ message: "Role is not available for this entity" }, 400);
  const [title] = await sql`select id from titles where id=${input.titleId}`;
  if (!title) return context.json({ message: "Title not found" }, 404);
  await sql`insert into contributions (title_id, entity_id, role_id, position, is_primary)
    values (${input.titleId}, ${entityId}, ${compatible.id}, ${input.position}, ${input.isPrimary})
    on conflict (title_id, entity_id, role_id) do update set
      position=excluded.position, is_primary=excluded.is_primary`;
  return context.json({ updated: true });
});

app.delete("/api/v1/admin/entities/:entityId/contributions", async (context) => {
  const parsed = adminEntityContributionDeleteSchema.safeParse(await context.req.json());
  if (!parsed.success)
    return context.json({ message: "Invalid contribution", issues: parsed.error.issues }, 400);
  const result = await database().client`delete from contributions c using roles r
    where c.role_id=r.id and c.entity_id=${context.req.param("entityId")}
      and c.title_id=${parsed.data.titleId} and r.slug=${parsed.data.role}`;
  return context.json({ deleted: result.count });
});

app.delete("/api/v1/admin/entities", async (context) => {
  const { ids = [] } = (await context.req.json()) as { ids?: string[] };
  if (!ids.length) return context.json({ deleted: 0 });
  const sql = database().client;
  const previousMedia = await sql`select distinct ma.path
    from media_asset_assignments x join media_assets ma on ma.id=x.asset_id
    where x.entity_id in ${sql(ids)}`;
  const result = await sql`delete from entities where id in ${sql(ids)}`;
  await purgeUnreferencedMedia(previousMedia.map((row) => row.path as string | null));
  return context.json({ deleted: result.count });
});

app.get("/api/v1/admin/planets", async (context) => {
  const rows = await database().client`select p.id, p.slug, p.name_ar as "nameAr",
    p.name_en as "nameEn", p.icon, p.description, p.primary_color as "primaryColor",
    p.secondary_color as "secondaryColor", p.display_order as "displayOrder",
    p.is_active as "isActive",
    (select count(*)::int from title_planets x where x.planet_id=p.id) as "workCount"
    from planets p order by p.display_order, p.name_ar`;
  return context.json(z.array(adminPlanetSchema).parse(rows));
});

app.post("/api/v1/admin/planets", async (context) => {
  const input = (await context.req.json()) as Partial<{
    id: string;
    slug: string;
    nameAr: string;
    nameEn: string | null;
    icon: string;
    description: string;
    primaryColor: string;
    secondaryColor: string;
    displayOrder: number;
    isActive: boolean;
  }>;
  const sql = database().client;
  const slug = input.slug?.trim();
  const nameAr = input.nameAr?.trim();
  const icon = input.icon?.trim();
  const primaryColor = input.primaryColor?.trim();
  const secondaryColor = input.secondaryColor?.trim();
  if (!slug || !nameAr || !icon || !primaryColor || !secondaryColor)
    return context.json({ message: "Planet fields are required" }, 400);
  if (input.id) {
    await sql`update planets set slug=${slug}, name_ar=${nameAr}, name_en=${input.nameEn ?? null}, icon=${icon}, description=${input.description ?? ""}, primary_color=${primaryColor}, secondary_color=${secondaryColor}, display_order=${input.displayOrder ?? 0}, is_active=${input.isActive ?? true}, updated_at=now() where id=${String(input.id)}`;
    return context.json({ id: String(input.id) });
  }
  const [row] =
    await sql`insert into planets (slug, name_ar, name_en, icon, description, primary_color, secondary_color, display_order, is_active) values (${slug}, ${nameAr}, ${input.nameEn ?? null}, ${icon}, ${input.description ?? ""}, ${primaryColor}, ${secondaryColor}, ${input.displayOrder ?? 0}, ${input.isActive ?? true}) returning id`;
  if (!row) return context.json({ message: "Could not create planet" }, 500);
  return context.json({ id: String(row.id) }, 201);
});

app.put("/api/v1/admin/planet-assignments", async (context) => {
  const { workIds = [], planetId } = (await context.req.json()) as {
    workIds?: string[];
    planetId?: string | null;
  };
  if (planetId === undefined || !workIds.length) return context.json({ updated: 0 });
  const sql = database().client;
  await sql.begin(async (transaction) => {
    await transaction`delete from title_planets where title_id in ${transaction(workIds)}`;
    if (planetId)
      for (const workId of workIds)
        await transaction`insert into title_planets (title_id, planet_id) values (${workId}, ${planetId})`;
  });
  return context.json({ updated: workIds.length });
});

app.post("/api/v1/admin/organization-relationships", async (context) => {
  const input = (await context.req.json()) as Partial<{
    sourceEntityId: string;
    targetEntityId: string;
    relationshipTypeId: string;
    occurredOn: string | null;
    description: string;
  }>;
  if (!input.sourceEntityId || !input.targetEntityId || !input.relationshipTypeId)
    return context.json({ message: "Relationship endpoints and type are required" }, 400);
  const [row] = await database().client`
    insert into organization_relations (source_id, target_id, relation_type, occurred_on, description)
    values (${input.sourceEntityId}, ${input.targetEntityId}, ${input.relationshipTypeId}, ${input.occurredOn || null}, ${input.description ?? ""}) returning id`;
  return context.json({ id: String(row?.id) }, 201);
});
app.all("/api/v1/admin/*", (context) =>
  context.json({ message: "مسار الإدارة المطلوب غير مطبّق." }, 501),
);

app.doc("/openapi.json", {
  openapi: "3.1.0",
  info: {
    title: "Arcadia API",
    version: "2.0.0",
    description: "Development API for Arcadia's media-first catalog.",
  },
});
app.notFound((context) => context.json({ message: "Not found" }, 404));
app.onError((error, context) => {
  console.error(error);
  return context.json(
    { message: process.env.NODE_ENV === "production" ? "Internal server error" : error.message },
    500,
  );
});
