import { randomUUID } from "node:crypto";
import {
  adminMediaAssignmentSchema,
  adminMediaSearchSchema,
  adminMediaUploadSchema,
  adminStatisticsSchema,
  adminVocabularyInputSchema,
  browseQuerySchema,
  browseResponseSchema,
  healthSchema,
  type mediaAssetSchema,
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
import { type mediaKinds, removeStoredMedia, storedMediaExists, storeMedia } from "./media-storage";
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
  awards: Array<{
    id?: string;
    organizationSlug: string;
    organizationName: string;
    category: string;
    year: number | null;
    result: "winner" | "nominee";
    isFeatured: boolean;
    installmentId: string | null;
    sourceUrl: string | null;
    notes: string | null;
  }>;
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
    await sql`delete from external_identities where title_id=${titleId}`;
    for (const link of input.externalLinks)
      await sql`insert into external_identities (title_id, provider, external_id, url) values (${titleId}, ${link.provider}, ${link.label || link.url}, ${link.url}) on conflict do nothing`;
  }
  if (input.awards) {
    const existingRows = await sql`select id from award_recognitions where title_id=${titleId}`;
    const existingIds = new Set(existingRows.map((row) => String(row.id)));
    const retainedIds: string[] = [];
    for (const [position, recognition] of input.awards.entries()) {
      const organizationName = recognition.organizationName.trim();
      const category = recognition.category.trim();
      if (!organizationName || !category) continue;
      const organizationSlug =
        recognition.organizationSlug.trim() ||
        organizationName
          .toLocaleLowerCase()
          .replaceAll(/[^\p{Letter}\p{Number}]+/gu, "-")
          .replaceAll(/(^-|-$)/g, "");
      const categorySlug = category
        .toLocaleLowerCase()
        .replaceAll(/[^\p{Letter}\p{Number}]+/gu, "-")
        .replaceAll(/(^-|-$)/g, "");
      const [organization] = await sql`insert into award_organizations (slug, name_ar, name_en)
        values (${organizationSlug}, ${organizationName}, ${organizationName})
        on conflict (slug) do update set name_ar=excluded.name_ar, updated_at=now()
        returning id`;
      if (!organization) throw new Error("Could not resolve the award organization");
      const [awardCategory] = await sql`insert into award_categories
        (organization_id, slug, name_ar, name_en)
        values (${organization.id}, ${categorySlug}, ${category}, ${category})
        on conflict (organization_id, slug) do update set name_ar=excluded.name_ar,
          updated_at=now() returning id`;
      if (!awardCategory) throw new Error("Could not resolve the award category");
      const [ceremony] = recognition.year
        ? await sql`insert into award_ceremonies (organization_id, year, label)
          values (${organization.id}, ${recognition.year}, ${String(recognition.year)})
          on conflict (organization_id, year) do update set updated_at=now() returning id`
        : [undefined];
      const recognitionId =
        recognition.id && existingIds.has(recognition.id) ? recognition.id : randomUUID();
      retainedIds.push(recognitionId);
      await sql`insert into award_recognitions
        (id, title_id, installment_id, organization_id, category_id, ceremony_id,
          organization_slug, organization_name, category, year, result, is_featured,
          source_url, notes, position)
        values (${recognitionId}, ${titleId}, ${recognition.installmentId || null},
          ${organization.id}, ${awardCategory.id}, ${ceremony?.id ?? null},
          ${organizationSlug}, ${organizationName}, ${category}, ${recognition.year},
          ${recognition.result}, ${recognition.isFeatured}, ${recognition.sourceUrl || null},
          ${recognition.notes || null}, ${position}) on conflict (id) do update set
          installment_id=excluded.installment_id, organization_id=excluded.organization_id,
          category_id=excluded.category_id, ceremony_id=excluded.ceremony_id,
          organization_slug=excluded.organization_slug,
          organization_name=excluded.organization_name, category=excluded.category,
          year=excluded.year, result=excluded.result, is_featured=excluded.is_featured,
          source_url=excluded.source_url, notes=excluded.notes, position=excluded.position,
          updated_at=now()`;
    }
    if (retainedIds.length)
      await sql`delete from award_recognitions where title_id=${titleId} and id not in ${sql(retainedIds)}`;
    else await sql`delete from award_recognitions where title_id=${titleId}`;
  }
}

async function contributionValidationError(
  sql: ReturnType<typeof database>["client"],
  contributors: AdminTitleInput["contributors"],
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
  const detail = await titleDetail(context.req.valid("param").titleId, false, current?.account.id);
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

async function recordTitleRevision(headers: Headers, titleId: string, input: AdminTitleInput) {
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
  const input = (await context.req.json()) as AdminTitleInput;
  const sql = database().client;
  const title = String(input.title ?? input.canonicalTitle ?? "").trim();
  if (!title) return context.json({ message: "Title is required" }, 400);
  const contributorError = await contributionValidationError(sql, input.contributors);
  if (contributorError) return context.json({ message: contributorError }, 400);
  input.imagePath = await materializeEmbeddedMedia(input.imagePath, title, "poster");
  input.bannerPath = await materializeEmbeddedMedia(input.bannerPath, title, "banner");
  input.logoPath = await materializeEmbeddedMedia(input.logoPath, title, "logo");
  const audience =
    input.audience === "Young Adult"
      ? "young-adult"
      : String(input.audience ?? "general").toLowerCase();
  const risk = input.riskProfile ?? {};
  if (input.id) {
    const [row] = await sql`
      update titles set
        canonical_title=${title}, sort_title=${title.toLocaleLowerCase()}, title_ar=${input.arabicTitle ?? null},
        summary=${String(input.summary ?? "")}, content_warnings=${input.contentWarnings ?? null}, analysis_notes=${input.analysisNotes ?? null}, release_year=${input.year ?? null},
        is_private=${input.isPrivate ?? false},
        audience=${audience}, sexuality_risk=${risk.sexuality ?? "none"},
        behavioral_risk=${risk.behavioral ?? "none"}, theology_risk=${risk.theology ?? "none"}, updated_at=now()
      where id=${String(input.id)} returning id`;
    if (!row) return context.json({ message: "Title not found" }, 404);
    await sql`update installments set title=${title}, summary=${String(input.summary ?? "")}, runtime_minutes=${input.runtimeMinutes ?? null}, status=${initialInstallmentStatus(input.releaseStatus)}, updated_at=now() where title_id=${String(input.id)} and (select count(*) from installments where title_id=${String(input.id)})=1`;
    await assignMediaPath(sql, input.imagePath, "poster", { titleId: String(input.id) });
    await assignMediaPath(sql, input.bannerPath, "banner", { titleId: String(input.id) });
    await assignMediaPath(sql, input.logoPath, "logo", { titleId: String(input.id) });
    await replaceTitleKnowledge(sql, String(input.id), input);
    await recordTitleRevision(context.req.raw.headers, String(input.id), input);
    return context.json({ id: String(input.id) });
  }
  const [row] = await sql`
    insert into titles (canonical_title, sort_title, title_ar, summary, content_warnings, analysis_notes, release_year, is_private, audience)
    values (${title}, ${title.toLocaleLowerCase()}, ${input.arabicTitle ?? null}, ${String(input.summary ?? "")}, ${input.contentWarnings ?? null}, ${input.analysisNotes ?? null}, ${input.year ?? null}, ${input.isPrivate ?? false}, ${audience}) returning id`;
  if (!row) return context.json({ message: "Could not create title" }, 500);
  const kind = ["series", "anime"].includes(String(input.kind)) ? "season" : "movie";
  await sql`insert into installments (title_id, kind, position, title, summary, status, runtime_minutes) values (${row.id}, ${kind}, 1, ${title}, ${String(input.summary ?? "")}, ${initialInstallmentStatus(input.releaseStatus)}, ${input.runtimeMinutes ?? null})`;
  await assignMediaPath(sql, input.imagePath, "poster", { titleId: String(row.id) });
  await assignMediaPath(sql, input.bannerPath, "banner", { titleId: String(row.id) });
  await assignMediaPath(sql, input.logoPath, "logo", { titleId: String(row.id) });
  await replaceTitleKnowledge(sql, String(row.id), input);
  await recordTitleRevision(context.req.raw.headers, String(row.id), input);
  return context.json({ id: String(row.id) }, 201);
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
        insert into installments (title_id, kind, position, title, summary, release_date, runtime_minutes, status)
        values (${titleId}, ${kind}, ${Number(season.position ?? index + 1)}, ${installmentTitle},
          ${String(season.summary ?? "")}, ${season.releaseAt ? new Date(Number(season.releaseAt)).toISOString().slice(0, 10) : null}, ${season.runtimeMinutes ?? null}, ${season.releaseStatus ?? "unknown"}) returning id`;
      if (!installment) throw new Error("Could not create installment");
      await assignMediaPath(transaction as unknown as typeof sql, posterPath, "poster", {
        installmentId: String(installment.id),
      });
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
  await purgeUnreferencedMedia(previousMedia.map((row) => row.path as string));
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
    const imagePath = await materializeEmbeddedMedia(input.imagePath, name, "profile");
    await sql`update entities set name=${name}, sort_name=${String(input.sortName ?? name)}, kind=${input.entityType ?? "person"}, description=${String(input.description ?? "")}, updated_at=now() where id=${String(input.id)}`;
    await assignMediaPath(sql, imagePath, "profile", { entityId: String(input.id) });
    return context.json({ id: String(input.id) });
  }
  const imagePath = await materializeEmbeddedMedia(input.imagePath, name, "profile");
  const [row] =
    await sql`insert into entities (name, sort_name, kind, description) values (${name}, ${String(input.sortName ?? name)}, ${input.entityType ?? "person"}, ${String(input.description ?? "")}) returning id`;
  if (!row) return context.json({ message: "Could not create entity" }, 500);
  await assignMediaPath(sql, imagePath, "profile", { entityId: String(row.id) });
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
