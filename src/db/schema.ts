import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: integer("created_at").notNull().default(sql`(unixepoch())`),
  updatedAt: integer("updated_at").notNull().default(sql`(unixepoch())`),
};

export const works = sqliteTable(
  "works",
  {
    id: text("id").primaryKey(),
    kind: text("kind").notNull(),
    canonicalTitle: text("canonical_title").notNull(),
    sortTitle: text("sort_title").notNull(),
    summary: text("summary").notNull().default(""),
    releaseYear: integer("release_year"),
    originalReleaseAt: integer("original_release_at"),
    runtimeMinutes: integer("runtime_minutes"),
    playtimeMinutes: integer("playtime_minutes"),
    pageCount: integer("page_count"),
    episodeCount: integer("episode_count"),
    chapterCount: integer("chapter_count"),
    volumeCount: integer("volume_count"),
    routeCount: integer("route_count"),
    status: text("status").notNull().default("released"),
    metadata: text("metadata", { mode: "json" })
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    ...timestamps,
  },
  (table) => [
    check(
      "works_kind_check",
      sql`${table.kind} in ('movie', 'series', 'anime', 'manga', 'novel', 'game', 'visual-novel', 'comic')`,
    ),
    check(
      "works_status_check",
      sql`${table.status} in ('announced', 'releasing', 'released', 'ended', 'unknown')`,
    ),
    check(
      "works_metrics_check",
      sql`(${table.runtimeMinutes} is null or ${table.runtimeMinutes} >= 0)
        and (${table.playtimeMinutes} is null or ${table.playtimeMinutes} >= 0)
        and (${table.pageCount} is null or ${table.pageCount} >= 0)
        and (${table.episodeCount} is null or ${table.episodeCount} >= 0)
        and (${table.chapterCount} is null or ${table.chapterCount} >= 0)
        and (${table.volumeCount} is null or ${table.volumeCount} >= 0)
        and (${table.routeCount} is null or ${table.routeCount} >= 0)`,
    ),
    check(
      "works_metadata_normalized_check",
      sql`json_type(${table.metadata}, '$.aliases') is null
        and json_type(${table.metadata}, '$.externalLinks') is null
        and json_type(${table.metadata}, '$.genres') is null
        and json_type(${table.metadata}, '$.tags') is null
        and json_type(${table.metadata}, '$.tone') is null
        and json_type(${table.metadata}, '$.studios') is null
        and json_type(${table.metadata}, '$.creator') is null`,
    ),
    index("works_kind_idx").on(table.kind),
    index("works_sort_title_idx").on(table.sortTitle),
    index("works_release_year_idx").on(table.releaseYear),
  ],
);

export const workTitles = sqliteTable(
  "work_titles",
  {
    id: text("id").primaryKey(),
    workId: text("work_id")
      .notNull()
      .references(() => works.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    titleType: text("title_type").notNull().default("alias"),
    language: text("language"),
    script: text("script"),
    isPreferred: integer("is_preferred", { mode: "boolean" }).notNull().default(false),
  },
  (table) => [
    check(
      "work_titles_type_check",
      sql`${table.titleType} in ('canonical', 'alias', 'localized', 'original')`,
    ),
    uniqueIndex("work_titles_identity_uq").on(
      table.workId,
      table.title,
      table.titleType,
      table.language,
    ),
    uniqueIndex("work_titles_preferred_language_uq")
      .on(table.workId, table.language)
      .where(sql`${table.isPreferred} = true and ${table.language} is not null`),
    index("work_titles_work_idx").on(table.workId),
  ],
);

export const entities = sqliteTable(
  "entities",
  {
    id: text("id").primaryKey(),
    entityType: text("entity_type").notNull(),
    name: text("name").notNull(),
    sortName: text("sort_name").notNull(),
    description: text("description").notNull().default(""),
    metadata: text("metadata", { mode: "json" })
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    ...timestamps,
  },
  (table) => [
    check("entities_type_check", sql`${table.entityType} in ('person', 'organization')`),
    uniqueIndex("entities_type_sort_name_uq").on(table.entityType, table.sortName),
    index("entities_type_idx").on(table.entityType),
    index("entities_sort_name_idx").on(table.sortName),
  ],
);

export const workContributors = sqliteTable(
  "work_contributions",
  {
    workId: text("work_id")
      .notNull()
      .references(() => works.id, { onDelete: "cascade" }),
    entityId: text("entity_id")
      .notNull()
      .references(() => entities.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    isPrimary: integer("is_primary", { mode: "boolean" }).notNull().default(false),
    position: integer("position").notNull().default(0),
  },
  (table) => [
    check(
      "work_contributions_role_check",
      sql`${table.role} in ('author', 'original-author', 'writer', 'screenwriter', 'director', 'illustrator', 'artist', 'animation-studio', 'production-company', 'producer', 'developer', 'publisher', 'composer', 'editor', 'translator', 'creator')`,
    ),
    primaryKey({ columns: [table.workId, table.entityId, table.role] }),
    index("work_contributions_entity_idx").on(table.entityId),
  ],
);

export const entityAliases = sqliteTable(
  "entity_aliases",
  {
    id: text("id").primaryKey(),
    entityId: text("entity_id")
      .notNull()
      .references(() => entities.id, { onDelete: "cascade" }),
    alias: text("alias").notNull(),
    normalizedAlias: text("normalized_alias").notNull(),
    language: text("language"),
  },
  (table) => [
    uniqueIndex("entity_aliases_identity_uq").on(table.entityId, table.normalizedAlias),
    index("entity_aliases_lookup_idx").on(table.normalizedAlias),
  ],
);

export const entityExternalIdentities = sqliteTable(
  "entity_external_identities",
  {
    id: text("id").primaryKey(),
    entityId: text("entity_id")
      .notNull()
      .references(() => entities.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    externalId: text("external_id").notNull(),
    url: text("url"),
  },
  (table) => [
    uniqueIndex("entity_external_identity_uq").on(table.provider, table.externalId),
    index("entity_external_identity_entity_idx").on(table.entityId),
  ],
);

export const terms = sqliteTable(
  "terms",
  {
    id: text("id").primaryKey(),
    vocabulary: text("vocabulary").notNull(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    parentId: text("parent_id"),
    color: text("color"),
    labelAr: text("label_ar"),
    description: text("description").notNull().default(""),
    descriptionAr: text("description_ar").notNull().default(""),
  },
  (table) => [
    check(
      "terms_vocabulary_check",
      sql`${table.vocabulary} in ('genre', 'tone', 'tag', 'audience', 'country', 'platform')`,
    ),
    check(
      "terms_controlled_values_check",
      sql`(
        ${table.vocabulary} <> 'genre'
        or ${table.name} in (
          'Action', 'Adventure', 'Comedy', 'Crime', 'Drama', 'Fantasy',
          'Historical', 'Horror', 'Mecha', 'Music', 'Mystery', 'Psychological',
          'Romance', 'Science Fiction', 'Slice of Life', 'Sports',
          'Supernatural', 'Thriller', 'War'
        )
      ) and (
        ${table.vocabulary} <> 'tone'
        or ${table.name} in (
          'Wholesome', 'Emotional', 'Bittersweet', 'Reflective', 'Tense',
          'Energetic', 'Dark', 'Whimsical', 'Epic', 'Atmospheric'
        )
      ) and (
        ${table.vocabulary} <> 'audience'
        or ${table.name} in ('Adult', 'Young Adult', 'Teen', 'General')
      )`,
    ),
    uniqueIndex("terms_vocabulary_slug_uq").on(table.vocabulary, table.slug),
    index("terms_parent_idx").on(table.parentId),
  ],
);

export const workTerms = sqliteTable(
  "work_terms",
  {
    workId: text("work_id")
      .notNull()
      .references(() => works.id, { onDelete: "cascade" }),
    termId: text("term_id")
      .notNull()
      .references(() => terms.id, { onDelete: "cascade" }),
    weight: real("weight").notNull().default(1),
    source: text("source").notNull().default("manual"),
  },
  (table) => [primaryKey({ columns: [table.workId, table.termId] })],
);

export const termAliases = sqliteTable(
  "term_aliases",
  {
    id: text("id").primaryKey(),
    termId: text("term_id")
      .notNull()
      .references(() => terms.id, { onDelete: "cascade" }),
    alias: text("alias").notNull(),
    language: text("language"),
    normalizedAlias: text("normalized_alias").notNull(),
  },
  (table) => [
    uniqueIndex("term_aliases_identity_uq").on(table.termId, table.normalizedAlias),
    index("term_aliases_lookup_idx").on(table.normalizedAlias),
  ],
);

export const workRelations = sqliteTable(
  "work_relations",
  {
    id: text("id").primaryKey(),
    sourceWorkId: text("source_work_id")
      .notNull()
      .references(() => works.id, { onDelete: "cascade" }),
    targetWorkId: text("target_work_id")
      .notNull()
      .references(() => works.id, { onDelete: "cascade" }),
    relationType: text("relation_type").notNull(),
    isDirected: integer("is_directed", { mode: "boolean" }).notNull().default(true),
    provenance: text("provenance").notNull().default("manual"),
    externalKey: text("external_key"),
    notes: text("notes").notNull().default(""),
  },
  (table) => [
    check(
      "work_relations_type_check",
      sql`${table.relationType} in ('sequel', 'adaptation', 'spin-off', 'side-story', 'compilation', 'alternative', 'related')`,
    ),
    check(
      "work_relations_distinct_endpoints_check",
      sql`${table.sourceWorkId} <> ${table.targetWorkId}`,
    ),
    check(
      "work_relations_direction_check",
      sql`(${table.relationType} in ('alternative', 'related') and ${table.isDirected} = false and ${table.sourceWorkId} < ${table.targetWorkId})
        or (${table.relationType} not in ('alternative', 'related') and ${table.isDirected} = true)`,
    ),
    uniqueIndex("work_relations_pair_type_uq").on(
      table.sourceWorkId,
      table.targetWorkId,
      table.relationType,
    ),
    index("work_relations_source_idx").on(table.sourceWorkId),
    index("work_relations_target_idx").on(table.targetWorkId),
  ],
);

export const personalState = sqliteTable(
  "personal_state",
  {
    workId: text("work_id")
      .primaryKey()
      .references(() => works.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("saved"),
    favorite: integer("favorite", { mode: "boolean" }).notNull().default(false),
    progress: real("progress").notNull().default(0),
    progressTotal: real("progress_total"),
    progressUnit: text("progress_unit").notNull().default("unit"),
    completedAt: integer("completed_at"),
    privateMetadata: text("private_metadata", { mode: "json" })
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    ...timestamps,
  },
  (table) => [
    check(
      "personal_state_status_check",
      sql`${table.status} in ('saved', 'planned', 'in-progress', 'completed', 'paused', 'dropped')`,
    ),
    check(
      "personal_state_values_check",
      sql`${table.progress} >= 0
        and (${table.progressTotal} is null or ${table.progressTotal} >= 0)
        and (${table.status} not in ('saved', 'planned') or ${table.progress} = 0)
        `,
    ),
    index("personal_state_status_idx").on(table.status),
  ],
);

export const personalScores = sqliteTable(
  "personal_scores",
  {
    workId: text("work_id")
      .notNull()
      .references(() => works.id, { onDelete: "cascade" }),
    criterion: text("criterion").notNull(),
    value: real("value").notNull(),
    updatedAt: integer("updated_at").notNull().default(sql`(unixepoch())`),
  },
  (table) => [
    check(
      "personal_scores_criterion_check",
      sql`${table.criterion} in ('story', 'characters', 'depth', 'worldBuilding', 'originality', 'craft')`,
    ),
    check("personal_scores_value_check", sql`${table.value} >= 0 and ${table.value} <= 10`),
    primaryKey({ columns: [table.workId, table.criterion] }),
    index("personal_scores_work_idx").on(table.workId),
  ],
);

export const workSeasons = sqliteTable(
  "work_seasons",
  {
    id: text("id").primaryKey(),
    workId: text("work_id")
      .notNull()
      .references(() => works.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    seasonNumber: real("season_number"),
    position: integer("position").notNull(),
    runtimeMinutes: integer("runtime_minutes"),
    unitCount: integer("unit_count"),
    releaseAt: integer("release_at"),
    ...timestamps,
  },
  (table) => [
    check(
      "work_seasons_values_check",
      sql`${table.position} >= 0
        and (${table.runtimeMinutes} is null or ${table.runtimeMinutes} >= 0)
        and (${table.unitCount} is null or ${table.unitCount} >= 0)`,
    ),
    uniqueIndex("work_seasons_position_uq").on(table.workId, table.position),
    uniqueIndex("work_seasons_title_uq").on(table.workId, table.title),
    index("work_seasons_work_idx").on(table.workId),
  ],
);

export const workUnits = sqliteTable(
  "work_units",
  {
    id: text("id").primaryKey(),
    workId: text("work_id")
      .notNull()
      .references(() => works.id, { onDelete: "cascade" }),
    seasonId: text("season_id").references(() => workSeasons.id, {
      onDelete: "cascade",
    }),
    unitType: text("unit_type").notNull(),
    title: text("title"),
    unitNumber: real("unit_number"),
    position: integer("position").notNull(),
    runtimeMinutes: integer("runtime_minutes"),
    pageCount: integer("page_count"),
    releaseAt: integer("release_at"),
    ...timestamps,
  },
  (table) => [
    check("work_units_type_check", sql`${table.unitType} in ('episode', 'chapter', 'volume')`),
    check(
      "work_units_values_check",
      sql`${table.position} >= 0
        and (${table.runtimeMinutes} is null or ${table.runtimeMinutes} >= 0)
        and (${table.pageCount} is null or ${table.pageCount} >= 0)`,
    ),
    uniqueIndex("work_units_season_position_uq").on(table.workId, table.seasonId, table.position),
    index("work_units_work_idx").on(table.workId),
    index("work_units_season_idx").on(table.seasonId),
  ],
);

export const trackingEntries = sqliteTable(
  "tracking_entries",
  {
    id: text("id").primaryKey(),
    workId: text("work_id")
      .notNull()
      .references(() => works.id, { onDelete: "cascade" }),
    progressBefore: integer("progress_before").notNull().default(0),
    progress: integer("progress").notNull(),
    statusBefore: text("status_before").notNull().default("planned"),
    status: text("status").notNull(),
    occurredOn: text("occurred_on").notNull(),
    daySequence: integer("day_sequence").notNull(),
    recordedAt: integer("recorded_at").notNull().default(sql`(unixepoch())`),
    voidedAt: integer("voided_at"),
    voidReason: text("void_reason"),
  },
  (table) => [
    check("tracking_entries_progress_before_check", sql`${table.progressBefore} >= 0`),
    check("tracking_entries_progress_check", sql`${table.progress} >= 0`),
    check(
      "tracking_entries_status_before_check",
      sql`${table.statusBefore} in ('saved', 'planned', 'in-progress', 'completed', 'paused', 'dropped')`,
    ),
    check(
      "tracking_entries_status_check",
      sql`${table.status} in ('saved', 'planned', 'in-progress', 'completed', 'paused', 'dropped')`,
    ),
    check(
      "tracking_entries_date_check",
      sql`${table.occurredOn} glob '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
        and date(${table.occurredOn}) = ${table.occurredOn}`,
    ),
    check("tracking_entries_sequence_check", sql`${table.daySequence} >= 0`),
    uniqueIndex("tracking_entries_work_day_sequence_uq").on(
      table.workId,
      table.occurredOn,
      table.daySequence,
    ),
    index("tracking_entries_work_order_idx").on(table.workId, table.occurredOn, table.daySequence),
    index("tracking_entries_order_idx").on(table.occurredOn, table.daySequence),
  ],
);

export const assets = sqliteTable(
  "assets",
  {
    id: text("id").primaryKey(),
    ownerType: text("owner_type").notNull().default("work"),
    ownerId: text("owner_id").notNull(),
    assetType: text("asset_type").notNull(),
    relativePath: text("relative_path").notNull(),
    mimeType: text("mime_type").notNull(),
    width: integer("width"),
    height: integer("height"),
    blurhash: text("blurhash"),
    checksum: text("checksum"),
    metadata: text("metadata", { mode: "json" }).$type<Record<string, unknown>>(),
    ...timestamps,
  },
  (table) => [
    check("assets_owner_type_check", sql`${table.ownerType} in ('work', 'entity', 'planet')`),
    check("assets_type_check", sql`${table.assetType} in ('poster', 'banner', 'logo', 'profile')`),
    uniqueIndex("assets_owner_type_uq").on(table.ownerType, table.ownerId, table.assetType),
    index("assets_owner_idx").on(table.ownerType, table.ownerId),
    index("assets_type_idx").on(table.assetType),
  ],
);

export const savedViews = sqliteTable(
  "saved_views",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    icon: text("icon").notNull().default("bookmark"),
    color: text("color").notNull().default("primary"),
    layout: text("layout").notNull().default("gallery"),
    filterTree: text("filter_tree", { mode: "json" }).$type<Record<string, unknown>>().notNull(),
    sortField: text("sort_field").notNull().default("title"),
    sortDirection: text("sort_direction").notNull().default("asc"),
    groupBy: text("group_by"),
    visibleColumns: text("visible_columns", { mode: "json" })
      .$type<string[]>()
      .notNull()
      .default([]),
    cardSize: integer("card_size").notNull().default(3),
    search: text("search").notNull().default(""),
    display: text("display", { mode: "json" })
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    isPinned: integer("is_pinned", { mode: "boolean" }).notNull().default(false),
    ...timestamps,
  },
  (table) => [
    check(
      "saved_views_layout_check",
      sql`${table.layout} in ('gallery', 'wide', 'table', 'timeline', 'statistics')`,
    ),
    check("saved_views_sort_direction_check", sql`${table.sortDirection} in ('asc', 'desc')`),
    check("saved_views_card_size_check", sql`${table.cardSize} >= 1 and ${table.cardSize} <= 300`),
    uniqueIndex("saved_views_name_uq").on(table.name),
    index("saved_views_pinned_idx").on(table.isPinned),
  ],
);

export const externalLinks = sqliteTable(
  "external_links",
  {
    id: text("id").primaryKey(),
    ownerType: text("owner_type").notNull(),
    ownerId: text("owner_id").notNull(),
    provider: text("provider").notNull(),
    label: text("label").notNull().default(""),
    url: text("url").notNull(),
    externalId: text("external_id"),
  },
  (table) => [
    check("external_links_owner_type_check", sql`${table.ownerType} = 'work'`),
    uniqueIndex("external_links_provider_uq").on(
      table.ownerType,
      table.ownerId,
      table.provider,
      table.url,
    ),
    index("external_links_owner_idx").on(table.ownerType, table.ownerId),
  ],
);

export const similarityArtifacts = sqliteTable(
  "similarity_artifacts",
  {
    id: text("id").primaryKey(),
    workId: text("work_id")
      .notNull()
      .references(() => works.id, { onDelete: "cascade" }),
    artifactType: text("artifact_type").notNull(),
    model: text("model"),
    dimensions: integer("dimensions"),
    vectorPath: text("vector_path"),
    fingerprint: text("fingerprint"),
    features: text("features", { mode: "json" }).$type<Record<string, number>>(),
    generatedAt: integer("generated_at").notNull().default(sql`(unixepoch())`),
  },
  (table) => [index("similarity_artifacts_work_idx").on(table.workId)],
);

export const planets = sqliteTable(
  "planets",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull(),
    nameAr: text("name_ar").notNull(),
    nameEn: text("name_en"),
    icon: text("icon").notNull(),
    description: text("description").notNull().default(""),
    primaryColor: text("primary_color").notNull(),
    secondaryColor: text("secondary_color").notNull(),
    displayOrder: integer("display_order").notNull().default(0),
    classificationHints: text("classification_hints", { mode: "json" })
      .$type<Record<string, string[]>>()
      .notNull()
      .default({}),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("planets_slug_uq").on(table.slug),
    index("planets_order_idx").on(table.isActive, table.displayOrder),
  ],
);

export const workPlanetAssignments = sqliteTable(
  "work_planet_assignments",
  {
    workId: text("work_id")
      .primaryKey()
      .references(() => works.id, { onDelete: "cascade" }),
    planetId: text("planet_id")
      .notNull()
      .references(() => planets.id, { onDelete: "restrict" }),
    source: text("source").notNull().default("manual"),
    confidence: real("confidence"),
    reviewState: text("review_state").notNull().default("reviewed"),
    featuredRank: integer("featured_rank"),
    ...timestamps,
  },
  (table) => [
    check(
      "work_planet_assignments_source_check",
      sql`${table.source} in ('migration-default', 'suggested', 'manual')`,
    ),
    check(
      "work_planet_assignments_review_check",
      sql`${table.reviewState} in ('needs-review', 'reviewed')`,
    ),
    check(
      "work_planet_assignments_confidence_check",
      sql`${table.confidence} is null or (${table.confidence} >= 0 and ${table.confidence} <= 1)`,
    ),
    index("work_planet_assignments_planet_idx").on(table.planetId),
    index("work_planet_assignments_review_idx").on(table.reviewState),
  ],
);

export const riskDimensions = sqliteTable(
  "risk_dimensions",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull(),
    nameAr: text("name_ar").notNull(),
    nameEn: text("name_en"),
    description: text("description").notNull().default(""),
    displayOrder: integer("display_order").notNull().default(0),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  },
  (table) => [uniqueIndex("risk_dimensions_slug_uq").on(table.slug)],
);

export const workRiskAssessments = sqliteTable(
  "work_risk_assessments",
  {
    workId: text("work_id")
      .notNull()
      .references(() => works.id, { onDelete: "cascade" }),
    dimensionId: text("dimension_id")
      .notNull()
      .references(() => riskDimensions.id, { onDelete: "restrict" }),
    level: text("level").notNull(),
    explanation: text("explanation").notNull().default(""),
    notes: text("notes").notNull().default(""),
    ...timestamps,
  },
  (table) => [
    check(
      "work_risk_assessments_level_check",
      sql`${table.level} in ('none', 'low', 'medium', 'high')`,
    ),
    primaryKey({ columns: [table.workId, table.dimensionId] }),
    index("work_risk_assessments_dimension_idx").on(table.dimensionId),
  ],
);

export const personProfiles = sqliteTable(
  "person_profiles",
  {
    entityId: text("entity_id")
      .primaryKey()
      .references(() => entities.id, { onDelete: "cascade" }),
    nativeName: text("native_name"),
    bornOn: text("born_on"),
    diedOn: text("died_on"),
    ...timestamps,
  },
  (table) => [index("person_profiles_dates_idx").on(table.bornOn, table.diedOn)],
);

export const organizationProfiles = sqliteTable(
  "organization_profiles",
  {
    entityId: text("entity_id")
      .primaryKey()
      .references(() => entities.id, { onDelete: "cascade" }),
    nativeName: text("native_name"),
    organizationType: text("organization_type").notNull().default("studio"),
    foundedOn: text("founded_on"),
    closedOn: text("closed_on"),
    countryTermId: text("country_term_id").references(() => terms.id, { onDelete: "set null" }),
    prominence: integer("prominence").notNull().default(0),
    ...timestamps,
  },
  (table) => [
    check(
      "organization_profiles_prominence_check",
      sql`${table.prominence} >= 0 and ${table.prominence} <= 3`,
    ),
    index("organization_profiles_type_idx").on(table.organizationType),
    index("organization_profiles_country_idx").on(table.countryTermId),
  ],
);

export const organizationRelationshipTypes = sqliteTable(
  "organization_relationship_types",
  {
    id: text("id").primaryKey(),
    nameAr: text("name_ar").notNull(),
    nameEn: text("name_en"),
    inverseNameAr: text("inverse_name_ar"),
    category: text("category").notNull(),
    isDirected: integer("is_directed", { mode: "boolean" }).notNull().default(true),
    allowsCycles: integer("allows_cycles", { mode: "boolean" }).notNull().default(false),
    displayOrder: integer("display_order").notNull().default(0),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  },
  (table) => [
    check(
      "organization_relationship_types_category_check",
      sql`${table.category} in ('corporate', 'historical', 'creative')`,
    ),
  ],
);

export const entityRelationships = sqliteTable(
  "entity_relationships",
  {
    id: text("id").primaryKey(),
    sourceEntityId: text("source_entity_id")
      .notNull()
      .references(() => entities.id, { onDelete: "cascade" }),
    targetEntityId: text("target_entity_id")
      .notNull()
      .references(() => entities.id, { onDelete: "cascade" }),
    relationshipTypeId: text("relationship_type_id")
      .notNull()
      .references(() => organizationRelationshipTypes.id, { onDelete: "restrict" }),
    occurredOn: text("occurred_on"),
    datePrecision: text("date_precision").notNull().default("unknown"),
    description: text("description").notNull().default(""),
    notes: text("notes").notNull().default(""),
    prominence: integer("prominence").notNull().default(0),
    ...timestamps,
  },
  (table) => [
    check(
      "entity_relationships_distinct_endpoints_check",
      sql`${table.sourceEntityId} <> ${table.targetEntityId}`,
    ),
    check(
      "entity_relationships_date_precision_check",
      sql`${table.datePrecision} in ('day', 'month', 'year', 'unknown')`,
    ),
    check(
      "entity_relationships_prominence_check",
      sql`${table.prominence} >= 0 and ${table.prominence} <= 3`,
    ),
    uniqueIndex("entity_relationships_identity_uq").on(
      table.sourceEntityId,
      table.targetEntityId,
      table.relationshipTypeId,
      table.occurredOn,
    ),
    index("entity_relationships_source_idx").on(table.sourceEntityId),
    index("entity_relationships_target_idx").on(table.targetEntityId),
    index("entity_relationships_date_idx").on(table.occurredOn),
  ],
);

export const entityRelationshipPeople = sqliteTable(
  "entity_relationship_people",
  {
    relationshipId: text("relationship_id")
      .notNull()
      .references(() => entityRelationships.id, { onDelete: "cascade" }),
    entityId: text("entity_id")
      .notNull()
      .references(() => entities.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("participant"),
    position: integer("position").notNull().default(0),
  },
  (table) => [
    primaryKey({ columns: [table.relationshipId, table.entityId, table.role] }),
    index("entity_relationship_people_entity_idx").on(table.entityId),
  ],
);

export const contributionRoles = sqliteTable(
  "contribution_roles",
  {
    id: text("id").primaryKey(),
    nameAr: text("name_ar").notNull(),
    nameEn: text("name_en").notNull(),
    allowedEntityType: text("allowed_entity_type").notNull().default("any"),
    displayOrder: integer("display_order").notNull().default(0),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  },
  (table) => [
    check(
      "contribution_roles_entity_type_check",
      sql`${table.allowedEntityType} in ('any', 'person', 'organization')`,
    ),
  ],
);

export const searchDocuments = sqliteTable(
  "search_documents",
  {
    id: text("id").primaryKey(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    primaryText: text("primary_text").notNull(),
    secondaryText: text("secondary_text").notNull().default(""),
    keywords: text("keywords").notNull().default(""),
    imagePath: text("image_path"),
    updatedAt: integer("updated_at").notNull().default(sql`(unixepoch())`),
  },
  (table) => [
    check(
      "search_documents_entity_type_check",
      sql`${table.entityType} in ('work', 'person', 'studio', 'planet')`,
    ),
    uniqueIndex("search_documents_entity_uq").on(table.entityType, table.entityId),
    index("search_documents_type_idx").on(table.entityType),
  ],
);
