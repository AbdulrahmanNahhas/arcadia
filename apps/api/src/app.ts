import {
  browseQuerySchema,
  browseResponseSchema,
  healthSchema,
  titleDetailSchema,
} from "@arcadia/contracts";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { cors } from "hono/cors";
import { database, databaseReady } from "./database";
import { mediaKinds, removeStoredMedia, storeMedia } from "./media-storage";
import { browse, titleDetail } from "./repository";

export const app = new OpenAPIHono();
app.use("*", cors({ origin: (origin) => origin || "http://127.0.0.1:3000" }));

const errorSchema = z.object({ message: z.string() });
type AdminScoreInput = Partial<{
  story: number | null;
  characters: number | null;
  depth: number | null;
  worldBuilding: number | null;
  originality: number | null;
  craft: number | null;
}>;
type AdminTitleInput = Partial<{
  id: string;
  title: string;
  canonicalTitle: string;
  arabicTitle: string | null;
  summary: string;
  contentWarnings: string | null;
  analysisNotes: string | null;
  year: number | null;
  imagePath: string | null;
  bannerPath: string | null;
  logoPath: string | null;
  isPrivate: boolean;
  audience: string | null;
  kind: string;
  releaseStatus: string;
  runtimeMinutes: number | null;
  riskProfile: Partial<Record<"sexuality" | "behavioral" | "theology", string>> | null;

  aliases: string[];
  genres: string[];
  tone: string[];
  tags: string[];
  country: string[];
  planetId: string | null;
  contributors: Array<{
    entityId: string;
    role: string;
    isPrimary?: boolean;
  }>;
  relations: Array<{
    workId: string;
    relationType: string;
    direction: "outgoing" | "incoming";
    notes?: string;
  }>;
  externalLinks: Array<{ provider: string; label: string; url: string }>;
}>;
type AdminStructureUnit = Partial<{
  title: string | null;
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
        units: z
          .array(
            z.object({
              id: z.string().optional(),
              unitType: z.literal("episode").default("episode"),
              title: z.string().nullable().optional(),
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
    const [usage] = await sql`
      select exists(select 1 from titles where poster_path=${path} or banner_path=${path} or logo_path=${path})
        or exists(select 1 from installments where poster_path=${path})
        or exists(select 1 from entities where profile_path=${path}) as referenced`;
    if (!usage?.referenced) {
      try {
        await removeStoredMedia(path);
      } catch (error) {
        console.warn(`Could not remove unreferenced media ${path}`, error);
      }
    }
  }
}

async function materializeEmbeddedMedia(
  value: string | null | undefined,
  ownerName: string,
  assetType: "poster" | "banner" | "logo",
) {
  if (!value?.startsWith("data:image/")) return value ?? null;
  return (
    await storeMedia({
      dataUrl: value,
      fileName: `${ownerName}-${assetType}`,
      ownerName,
      assetType,
    })
  ).relativePath;
}

async function replaceTitleKnowledge(
  sql: ReturnType<typeof database>["client"],
  titleId: string,
  input: AdminTitleInput,
) {
  if (input.aliases) {
    await sql`delete from title_aliases where title_id=${titleId}`;
    const aliases = new Map<string, string>();
    for (const value of input.aliases) {
      const alias = value.trim();
      if (alias) aliases.set(alias.toLocaleLowerCase(), alias);
    }
    for (const alias of aliases.values())
      await sql`insert into title_aliases (title_id, title) values (${titleId}, ${alias}) on conflict do nothing`;
  }
  const taxonomies = [
    ["genres", "title_genres", input.genres],
    ["tones", "title_tones", input.tone],
    ["tags", "title_tags", input.tags],
    ["countries", "title_countries", input.country],
  ] as const;
  for (const [lookupTable, linkTable, values] of taxonomies) {
    if (!values) continue;
    await sql`delete from ${sql(linkTable)} where title_id=${titleId}`;
    for (const value of values) {
      const slug = value
        .trim()
        .toLocaleLowerCase()
        .replaceAll(/[^a-z0-9]+/g, "-");
      const [lookup] =
        await sql`select id from ${sql(lookupTable)} where slug=${slug} or lower(label_en)=lower(${value.trim()}) limit 1`;
      if (lookup)
        await sql`insert into ${sql(linkTable)} (title_id, value_id) values (${titleId}, ${lookup.id}) on conflict do nothing`;
    }
  }
  if (input.planetId !== undefined) {
    await sql`delete from title_planets where title_id=${titleId}`;
    if (input.planetId)
      await sql`insert into title_planets (title_id, planet_id) values (${titleId}, ${input.planetId})`;
  }
  if (input.contributors) {
    await sql`delete from contributions where title_id=${titleId}`;
    for (const [position, credit] of input.contributors.entries()) {
      const [role] = await sql`select id from roles where slug=${credit.role}`;
      if (role)
        await sql`insert into contributions (title_id, entity_id, role_id, position, is_primary) values (${titleId}, ${credit.entityId}, ${role.id}, ${position}, ${credit.isPrimary ?? false}) on conflict do nothing`;
    }
  }
  if (input.relations) {
    await sql`delete from title_relations where source_title_id=${titleId} or target_title_id=${titleId}`;
    for (const relation of input.relations) {
      const sourceId = relation.direction === "incoming" ? relation.workId : titleId;
      const targetId = relation.direction === "incoming" ? titleId : relation.workId;
      await sql`insert into title_relations (source_title_id, target_title_id, kind, notes) values (${sourceId}, ${targetId}, ${relation.relationType}, ${relation.notes ?? ""}) on conflict do nothing`;
    }
  }
  if (input.externalLinks) {
    await sql`delete from external_identities where owner_type='title' and owner_id=${titleId}`;
    for (const link of input.externalLinks)
      await sql`insert into external_identities (owner_type, owner_id, provider, external_id, url) values ('title', ${titleId}, ${link.provider}, ${link.label || link.url}, ${link.url}) on conflict do nothing`;
  }
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
app.openapi(browseRoute, async (context) => context.json(await browse(context.req.valid("query"))));

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
  const detail = await titleDetail(context.req.valid("param").titleId);
  return detail ? context.json(detail, 200) : context.json({ message: "Title not found" }, 404);
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
          ? await sql`select e.id, e.name, e.sort_name as "sortName", e.description, e.profile_path as "profilePath",
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
                  end as "releaseStatus", t.poster_path as "imagePath",
                  array_agg(distinct r.slug) as roles
                from contributions c join titles t on t.id=c.title_id join roles r on r.id=c.role_id
                left join installments i on i.title_id=t.id where c.entity_id=e.id and not t.is_private
                group by t.id
              ) item), '[]'::json) as works
            from entities e where e.kind='person' order by e.sort_name`
          : resource === "studios"
            ? await sql`select e.id, e.name, e.sort_name as "sortName", e.description, e.profile_path as "profilePath",
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
                  end as "releaseStatus", t.poster_path as "imagePath",
                    array_agg(distinct r.slug) as roles
                  from contributions c join titles t on t.id=c.title_id join roles r on r.id=c.role_id
                  left join installments i on i.title_id=t.id where c.entity_id=e.id and not t.is_private
                  group by t.id
                ) item), '[]'::json) as works
              from entities e where e.kind='organization' order by e.sort_name`
            : await sql`select r.id, r.source_title_id as "sourceTitleId", r.target_title_id as "targetTitleId", r.kind from title_relations r join titles source on source.id=r.source_title_id join titles target on target.id=r.target_title_id where not source.is_private and not target.is_private`;
    return context.json(rows);
  });
}

app.get("/api/v1/organization-relationships", async (context) => {
  const rows = await database()
    .client`select id, source_id as "sourceId", target_id as "targetId", relation_type as "relationType", occurred_on as "occurredOn", description from organization_relations order by occurred_on nulls last`;
  return context.json(rows);
});

// TODO(auth): replace this single boundary with verified administrator sessions.
app.use("/api/v1/admin/*", async (context, next) => {
  if (process.env.NODE_ENV === "production" || process.env.ARCADIA_MOCK_AUTH !== "true")
    return context.json({ message: "Development administrator API is disabled" }, 403);
  context.header("X-Arcadia-Auth", "mock-development-only");
  await next();
});
app.get("/api/v1/admin/status", (context) =>
  context.json({ mode: "mock", productionAllowed: false }),
);

app.post("/api/v1/admin/media", async (context) => {
  const parsed = z
    .object({
      dataUrl: z.string().max(14_000_000),
      fileName: z.string().trim().min(1).max(255),
      ownerName: z.string().trim().min(1).max(200),
      assetType: z.enum(mediaKinds),
    })
    .safeParse(await context.req.json());
  if (!parsed.success) return context.json({ message: "Invalid image upload" }, 400);
  try {
    return context.json(await storeMedia(parsed.data), 201);
  } catch (error) {
    return context.json(
      { message: error instanceof Error ? error.message : "Image upload failed" },
      400,
    );
  }
});

app.post("/api/v1/admin/titles/:titleId/materialize-media", async (context) => {
  const titleId = context.req.param("titleId");
  const sql = database().client;
  const [title] = await sql`
    select canonical_title, poster_path, banner_path, logo_path from titles where id=${titleId}`;
  if (!title) return context.json({ message: "Title not found" }, 404);

  let converted = 0;
  for (const [column, assetType] of [
    ["poster_path", "poster"],
    ["banner_path", "banner"],
    ["logo_path", "logo"],
  ] as const) {
    const current = title[column] as string | null;
    if (!current?.startsWith("data:image/")) continue;
    const stored = await materializeEmbeddedMedia(
      current,
      String(title.canonical_title),
      assetType,
    );
    await sql`update titles set ${sql(column)}=${stored}, updated_at=now() where id=${titleId}`;
    converted += 1;
  }

  const installments = await sql`
    select id, title, kind, position, poster_path from installments
    where title_id=${titleId} and poster_path like 'data:image/%'`;
  for (const installment of installments) {
    const installmentName =
      String(installment.title ?? "").trim() || `Installment ${Number(installment.position) + 1}`;
    const stored = await materializeEmbeddedMedia(
      installment.poster_path as string,
      `${String(title.canonical_title)} ${String(installment.kind)} ${Number(installment.position) + 1} ${installmentName}`,
      "poster",
    );
    await sql`update installments set poster_path=${stored}, updated_at=now() where id=${installment.id}`;
    converted += 1;
  }
  return context.json({ titleId, converted });
});

app.get("/api/v1/admin/overview", async (context) => {
  const sql = database().client;
  const [metrics] = await sql`
    select
      (select count(*)::int from titles) as titles,
      (select count(*)::int from titles where is_private) as private_titles,
      (select count(*)::int from titles where title_ar is null or btrim(title_ar)='') as missing_arabic,
      (select count(*)::int from titles where poster_path is null or btrim(poster_path)='') as missing_posters,
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

app.post("/api/v1/admin/titles", async (context) => {
  const input = (await context.req.json()) as AdminTitleInput;
  const sql = database().client;
  const title = String(input.title ?? input.canonicalTitle ?? "").trim();
  if (!title) return context.json({ message: "Title is required" }, 400);
  input.imagePath = await materializeEmbeddedMedia(input.imagePath, title, "poster");
  input.bannerPath = await materializeEmbeddedMedia(input.bannerPath, title, "banner");
  input.logoPath = await materializeEmbeddedMedia(input.logoPath, title, "logo");
  const audience =
    input.audience === "Young Adult"
      ? "young-adult"
      : String(input.audience ?? "general").toLowerCase();
  const risk = input.riskProfile ?? {};
  if (input.id) {
    const [previousMedia] =
      await sql`select poster_path, banner_path, logo_path from titles where id=${String(input.id)}`;
    const [row] = await sql`
      update titles set
        canonical_title=${title}, sort_title=${title.toLocaleLowerCase()}, title_ar=${input.arabicTitle ?? null},
        summary=${String(input.summary ?? "")}, content_warnings=${input.contentWarnings ?? null}, analysis_notes=${input.analysisNotes ?? null}, release_year=${input.year ?? null},
        poster_path=${input.imagePath ?? null}, banner_path=${input.bannerPath ?? null}, logo_path=${input.logoPath ?? null}, is_private=${input.isPrivate ?? false},
        audience=${audience}, sexuality_risk=${risk.sexuality ?? "none"},
        behavioral_risk=${risk.behavioral ?? "none"}, theology_risk=${risk.theology ?? "none"}, updated_at=now()
      where id=${String(input.id)} returning id`;
    if (!row) return context.json({ message: "Title not found" }, 404);
    await sql`update installments set title=${title}, summary=${String(input.summary ?? "")}, runtime_minutes=${input.runtimeMinutes ?? null}, status=${initialInstallmentStatus(input.releaseStatus)}, updated_at=now() where title_id=${String(input.id)} and (select count(*) from installments where title_id=${String(input.id)})=1`;
    await replaceTitleKnowledge(sql, String(input.id), input);
    await purgeUnreferencedMedia([
      previousMedia?.poster_path,
      previousMedia?.banner_path,
      previousMedia?.logo_path,
    ]);
    return context.json({ id: String(input.id) });
  }
  const [row] = await sql`
    insert into titles (canonical_title, sort_title, title_ar, summary, content_warnings, analysis_notes, release_year, poster_path, banner_path, logo_path, is_private, audience)
    values (${title}, ${title.toLocaleLowerCase()}, ${input.arabicTitle ?? null}, ${String(input.summary ?? "")}, ${input.contentWarnings ?? null}, ${input.analysisNotes ?? null}, ${input.year ?? null}, ${input.imagePath ?? null}, ${input.bannerPath ?? null}, ${input.logoPath ?? null}, ${input.isPrivate ?? false}, ${audience}) returning id`;
  if (!row) return context.json({ message: "Could not create title" }, 500);
  const kind = ["series", "anime"].includes(String(input.kind)) ? "season" : "movie";
  await sql`insert into installments (title_id, kind, position, title, summary, status, runtime_minutes) values (${row.id}, ${kind}, 1, ${title}, ${String(input.summary ?? "")}, ${initialInstallmentStatus(input.releaseStatus)}, ${input.runtimeMinutes ?? null})`;
  await replaceTitleKnowledge(sql, String(row.id), input);
  return context.json({ id: String(row.id) }, 201);
});

app.delete("/api/v1/admin/titles", async (context) => {
  const { ids = [] } = (await context.req.json()) as { ids?: string[] };
  if (!ids.length) return context.json({ deleted: 0 });
  const sql = database().client;
  const previousMedia = await sql`
    select poster_path as path from titles where id in ${sql(ids)}
    union all select banner_path from titles where id in ${sql(ids)}
    union all select logo_path from titles where id in ${sql(ids)}
    union all select i.poster_path from installments i where i.title_id in ${sql(ids)}`;
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
    await sql`select poster_path from installments where title_id=${titleId} and poster_path is not null`;
  await sql.begin(async (transaction) => {
    const preservedScoreRows =
      await transaction`select i.id, s.story, s.characters, s.depth, s.world_building, s.originality, s.craft from installments i join installment_scores s on s.installment_id=i.id where i.title_id=${titleId}`;
    const preservedScores = new Map(preservedScoreRows.map((score) => [String(score.id), score]));
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
      const [installment] = await transaction`
        insert into installments (title_id, kind, position, title, summary, release_date, runtime_minutes, status, poster_path)
        values (${titleId}, ${kind}, ${Number(season.position ?? index + 1)}, ${installmentTitle},
          ${String(season.summary ?? "")}, ${season.releaseAt ? new Date(Number(season.releaseAt)).toISOString().slice(0, 10) : null}, ${season.runtimeMinutes ?? null}, ${season.releaseStatus ?? "unknown"}, ${posterPath}) returning id`;
      if (!installment) throw new Error("Could not create installment");
      const preservedScore = season.id ? preservedScores.get(season.id) : undefined;
      const requestedScore = season.score;
      if (requestedScore || preservedScore)
        await transaction`insert into installment_scores (installment_id, story, characters, depth, world_building, originality, craft) values (${installment.id}, ${requestedScore?.story ?? preservedScore?.story ?? null}, ${requestedScore?.characters ?? preservedScore?.characters ?? null}, ${requestedScore?.depth ?? preservedScore?.depth ?? null}, ${requestedScore?.worldBuilding ?? preservedScore?.world_building ?? null}, ${requestedScore?.originality ?? preservedScore?.originality ?? null}, ${requestedScore?.craft ?? preservedScore?.craft ?? null})`;
      for (const [unitIndex, unit] of units.entries())
        await transaction`
        insert into episodes (installment_id, number, position, title, release_date, runtime_minutes)
        values (${installment.id}, ${unit.unitNumber ?? unitIndex + 1}, ${Number(unit.position ?? unitIndex + 1)}, ${unit.title ?? null},
          ${unit.releaseAt ? new Date(Number(unit.releaseAt)).toISOString().slice(0, 10) : null}, ${unit.runtimeMinutes ?? null})`;
    }
    if (!(input.seasons ?? []).length) {
      const [installment] = await transaction`
        insert into installments (title_id, kind, position, title, status)
        select id, 'season', 1, canonical_title, 'unknown' from titles where id=${titleId} returning id`;
      if (!installment) throw new Error("Title not found");
      for (const [index, unit] of (input.ungroupedUnits ?? []).entries())
        await transaction`
        insert into episodes (installment_id, number, position, title, runtime_minutes)
        values (${installment.id}, ${unit.unitNumber ?? index + 1}, ${Number(unit.position ?? index + 1)}, ${unit.title ?? null}, ${unit.runtimeMinutes ?? null})`;
    }
  });
  await purgeUnreferencedMedia(previousMedia.map((row) => row.poster_path as string));
  return context.json({ titleId });
});

app.post("/api/v1/admin/entities", async (context) => {
  const input = (await context.req.json()) as Partial<{
    id: string;
    name: string;
    sortName: string;
    entityType: "person" | "organization";
    description: string;
    imagePath: string | null;
  }>;
  const sql = database().client;
  const name = String(input.name ?? "").trim();
  if (!name) return context.json({ message: "Name is required" }, 400);
  if (input.id) {
    await sql`update entities set name=${name}, sort_name=${String(input.sortName ?? name)}, kind=${input.entityType ?? "person"}, description=${String(input.description ?? "")}, profile_path=${input.imagePath ?? null}, updated_at=now() where id=${String(input.id)}`;
    return context.json({ id: String(input.id) });
  }
  const [row] =
    await sql`insert into entities (name, sort_name, kind, description, profile_path) values (${name}, ${String(input.sortName ?? name)}, ${input.entityType ?? "person"}, ${String(input.description ?? "")}, ${input.imagePath ?? null}) returning id`;
  if (!row) return context.json({ message: "Could not create entity" }, 500);
  return context.json({ id: String(row.id) }, 201);
});

app.delete("/api/v1/admin/entities", async (context) => {
  const { ids = [] } = (await context.req.json()) as { ids?: string[] };
  if (!ids.length) return context.json({ deleted: 0 });
  const result = await database()
    .client`delete from entities where id in ${database().client(ids)}`;
  return context.json({ deleted: result.count });
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
    planetId?: string;
  };
  if (!planetId || !workIds.length) return context.json({ updated: 0 });
  const sql = database().client;
  await sql.begin(async (transaction) => {
    await transaction`delete from title_planets where title_id in ${transaction(workIds)}`;
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
  context.json({ message: "TODO(auth): catalog mutation adapter" }, 501),
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
