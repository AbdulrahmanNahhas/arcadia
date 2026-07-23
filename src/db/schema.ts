import { sql } from "drizzle-orm"
import {
  check,
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core"
import type { FilterNode } from "@/features/library/model"

const timestamps = {
  createdAt: integer("created_at")
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at")
    .notNull()
    .default(sql`(unixepoch())`),
}

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
    pageCount: integer("page_count"),
    primaryPlatform: text("primary_platform"),
    episodeCount: integer("episode_count"),
    chapterCount: integer("chapter_count"),
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
      sql`${table.kind} in ('movie', 'series', 'anime', 'manga', 'novel', 'game', 'visual-novel', 'comic')`
    ),
    check(
      "works_status_check",
      sql`${table.status} in ('announced', 'releasing', 'released', 'ended', 'unknown')`
    ),
    check(
      "works_metrics_check",
      sql`(${table.runtimeMinutes} is null or ${table.runtimeMinutes} >= 0)
        and (${table.pageCount} is null or ${table.pageCount} >= 0)
        and (${table.episodeCount} is null or ${table.episodeCount} >= 0)
        and (${table.chapterCount} is null or ${table.chapterCount} >= 0)`
    ),
    check(
      "works_metadata_normalized_check",
      sql`json_type(${table.metadata}, '$.aliases') is null
        and json_type(${table.metadata}, '$.externalLinks') is null
        and json_type(${table.metadata}, '$.genres') is null
        and json_type(${table.metadata}, '$.tags') is null
        and json_type(${table.metadata}, '$.tone') is null
        and json_type(${table.metadata}, '$.studios') is null
        and json_type(${table.metadata}, '$.creator') is null`
    ),
    index("works_kind_idx").on(table.kind),
    index("works_sort_title_idx").on(table.sortTitle),
    index("works_release_year_idx").on(table.releaseYear),
  ]
)

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
    isPreferred: integer("is_preferred", { mode: "boolean" })
      .notNull()
      .default(false),
  },
  (table) => [
    check(
      "work_titles_type_check",
      sql`${table.titleType} in ('canonical', 'alias', 'localized', 'original')`
    ),
    uniqueIndex("work_titles_identity_uq").on(
      table.workId,
      table.title,
      table.titleType,
      table.language
    ),
    index("work_titles_work_idx").on(table.workId),
  ]
)

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
    check(
      "entities_type_check",
      sql`${table.entityType} in ('person', 'studio', 'publisher', 'organization')`
    ),
    uniqueIndex("entities_type_sort_name_uq").on(
      table.entityType,
      table.sortName
    ),
    index("entities_type_idx").on(table.entityType),
    index("entities_sort_name_idx").on(table.sortName),
  ]
)

export const workCredits = sqliteTable(
  "work_credits",
  {
    workId: text("work_id")
      .notNull()
      .references(() => works.id, { onDelete: "cascade" }),
    entityId: text("entity_id")
      .notNull()
      .references(() => entities.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    position: integer("position").notNull().default(0),
  },
  (table) => [
    check(
      "work_credits_role_check",
      sql`${table.role} in ('author', 'director', 'main-studio', 'publisher', 'creator')`
    ),
    primaryKey({ columns: [table.workId, table.entityId, table.role] }),
    index("work_credits_entity_idx").on(table.entityId),
  ]
)

export const terms = sqliteTable(
  "terms",
  {
    id: text("id").primaryKey(),
    vocabulary: text("vocabulary").notNull(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    parentId: text("parent_id"),
    color: text("color"),
    description: text("description").notNull().default(""),
  },
  (table) => [
    check(
      "terms_vocabulary_check",
      sql`${table.vocabulary} in ('genre', 'tone', 'tag', 'audience', 'country', 'era')`
    ),
    check(
      "terms_controlled_values_check",
      sql`(
        ${table.vocabulary} <> 'genre'
        or ${table.name} in (
          'Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Historical',
          'Horror', 'Mecha', 'Military', 'Music', 'Mystery', 'Political',
          'Psychological', 'Romance', 'Sci-Fi', 'Slice of Life', 'Sports',
          'Supernatural', 'Thriller'
        )
      ) and (
        ${table.vocabulary} <> 'tone'
        or ${table.name} in (
          'Wholesome', 'Emotional', 'Bittersweet', 'Reflective', 'Tense',
          'Hype / Energetic', 'Dark', 'Surreal / Whimsical', 'Epic',
          'Atmospheric'
        )
      )`
    ),
    uniqueIndex("terms_vocabulary_slug_uq").on(table.vocabulary, table.slug),
    index("terms_parent_idx").on(table.parentId),
  ]
)

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
  (table) => [primaryKey({ columns: [table.workId, table.termId] })]
)

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
    isDirected: integer("is_directed", { mode: "boolean" })
      .notNull()
      .default(true),
    notes: text("notes").notNull().default(""),
  },
  (table) => [
    uniqueIndex("work_relations_pair_type_uq").on(
      table.sourceWorkId,
      table.targetWorkId,
      table.relationType
    ),
    index("work_relations_source_idx").on(table.sourceWorkId),
    index("work_relations_target_idx").on(table.targetWorkId),
  ]
)

export const fieldDefinitions = sqliteTable(
  "field_definitions",
  {
    id: text("id").primaryKey(),
    key: text("key").notNull().unique(),
    label: text("label").notNull(),
    dataType: text("data_type").notNull(),
    appliesTo: text("applies_to", { mode: "json" }).$type<string[]>().notNull(),
    config: text("config", { mode: "json" })
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    position: integer("position").notNull().default(0),
    ...timestamps,
  },
  (table) => [index("field_definitions_position_idx").on(table.position)]
)

export const fieldValues = sqliteTable(
  "field_values",
  {
    workId: text("work_id")
      .notNull()
      .references(() => works.id, { onDelete: "cascade" }),
    fieldId: text("field_id")
      .notNull()
      .references(() => fieldDefinitions.id, { onDelete: "cascade" }),
    textValue: text("text_value"),
    numberValue: real("number_value"),
    booleanValue: integer("boolean_value", { mode: "boolean" }),
    dateValue: integer("date_value"),
    jsonValue: text("json_value", { mode: "json" }).$type<unknown>(),
    updatedAt: integer("updated_at")
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [primaryKey({ columns: [table.workId, table.fieldId] })]
)

export const personalState = sqliteTable(
  "personal_state",
  {
    workId: text("work_id")
      .primaryKey()
      .references(() => works.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("planned"),
    rating: real("rating"),
    favorite: integer("favorite", { mode: "boolean" }).notNull().default(false),
    owned: integer("owned", { mode: "boolean" }).notNull().default(false),
    wishlist: integer("wishlist", { mode: "boolean" }).notNull().default(false),
    progress: real("progress").notNull().default(0),
    progressTotal: real("progress_total"),
    progressUnit: text("progress_unit").notNull().default("unit"),
    completedAt: integer("completed_at"),
    notes: text("notes").notNull().default(""),
    privateMetadata: text("private_metadata", { mode: "json" })
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    ...timestamps,
  },
  (table) => [
    check(
      "personal_state_status_check",
      sql`${table.status} in ('planned', 'in-progress', 'completed', 'paused', 'dropped')`
    ),
    check(
      "personal_state_values_check",
      sql`${table.progress} >= 0
        and (${table.progressTotal} is null or ${table.progressTotal} >= 0)
        and (${table.rating} is null or (${table.rating} >= 0 and ${table.rating} <= 10))`
    ),
    index("personal_state_status_idx").on(table.status),
  ]
)

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
        and (${table.unitCount} is null or ${table.unitCount} >= 0)`
    ),
    uniqueIndex("work_seasons_position_uq").on(table.workId, table.position),
    uniqueIndex("work_seasons_title_uq").on(table.workId, table.title),
    index("work_seasons_work_idx").on(table.workId),
  ]
)

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
    check(
      "work_units_type_check",
      sql`${table.unitType} in ('episode', 'chapter', 'volume')`
    ),
    check(
      "work_units_values_check",
      sql`${table.position} >= 0
        and (${table.runtimeMinutes} is null or ${table.runtimeMinutes} >= 0)
        and (${table.pageCount} is null or ${table.pageCount} >= 0)`
    ),
    uniqueIndex("work_units_season_position_uq").on(
      table.workId,
      table.seasonId,
      table.position
    ),
    index("work_units_work_idx").on(table.workId),
    index("work_units_season_idx").on(table.seasonId),
  ]
)

export const trackingEntries = sqliteTable(
  "tracking_entries",
  {
    id: text("id").primaryKey(),
    workId: text("work_id")
      .notNull()
      .references(() => works.id, { onDelete: "cascade" }),
    progress: integer("progress").notNull(),
    status: text("status").notNull(),
    occurredOn: text("occurred_on").notNull(),
    daySequence: integer("day_sequence").notNull(),
    recordedAt: integer("recorded_at")
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    check("tracking_entries_progress_check", sql`${table.progress} >= 0`),
    check(
      "tracking_entries_status_check",
      sql`${table.status} in ('planned', 'in-progress', 'completed', 'paused', 'dropped')`
    ),
    check(
      "tracking_entries_date_check",
      sql`${table.occurredOn} glob '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
        and date(${table.occurredOn}) = ${table.occurredOn}`
    ),
    check("tracking_entries_sequence_check", sql`${table.daySequence} >= 0`),
    uniqueIndex("tracking_entries_work_day_sequence_uq").on(
      table.workId,
      table.occurredOn,
      table.daySequence
    ),
    index("tracking_entries_work_order_idx").on(
      table.workId,
      table.occurredOn,
      table.daySequence
    ),
    index("tracking_entries_order_idx").on(table.occurredOn, table.daySequence),
  ]
)

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
    metadata: text("metadata", { mode: "json" }).$type<
      Record<string, unknown>
    >(),
    ...timestamps,
  },
  (table) => [
    check("assets_owner_type_check", sql`${table.ownerType} = 'work'`),
    check(
      "assets_type_check",
      sql`${table.assetType} in ('poster', 'banner', 'logo')`
    ),
    uniqueIndex("assets_owner_type_uq").on(
      table.ownerType,
      table.ownerId,
      table.assetType
    ),
    index("assets_owner_idx").on(table.ownerType, table.ownerId),
    index("assets_type_idx").on(table.assetType),
  ]
)

export const collections = sqliteTable(
  "collections",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    collectionType: text("collection_type").notNull().default("manual"),
    description: text("description").notNull().default(""),
    filterTree: text("filter_tree", { mode: "json" }).$type<FilterNode>(),
    coverAssetId: text("cover_asset_id"),
    settings: text("settings", { mode: "json" })
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    ...timestamps,
  },
  (table) => [index("collections_type_idx").on(table.collectionType)]
)

export const collectionItems = sqliteTable(
  "collection_items",
  {
    collectionId: text("collection_id")
      .notNull()
      .references(() => collections.id, { onDelete: "cascade" }),
    workId: text("work_id")
      .notNull()
      .references(() => works.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
    addedAt: integer("added_at")
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [primaryKey({ columns: [table.collectionId, table.workId] })]
)

export const savedViews = sqliteTable(
  "saved_views",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    layout: text("layout").notNull().default("gallery"),
    filterTree: text("filter_tree", { mode: "json" })
      .$type<Record<string, unknown>>()
      .notNull(),
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
    isPinned: integer("is_pinned", { mode: "boolean" })
      .notNull()
      .default(false),
    ...timestamps,
  },
  (table) => [
    check(
      "saved_views_layout_check",
      sql`${table.layout} in ('gallery', 'table', 'timeline', 'statistics')`
    ),
    check(
      "saved_views_sort_direction_check",
      sql`${table.sortDirection} in ('asc', 'desc')`
    ),
    check(
      "saved_views_card_size_check",
      sql`${table.cardSize} >= 1 and ${table.cardSize} <= 300`
    ),
    uniqueIndex("saved_views_name_uq").on(table.name),
    index("saved_views_pinned_idx").on(table.isPinned),
  ]
)

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
      table.url
    ),
    index("external_links_owner_idx").on(table.ownerType, table.ownerId),
  ]
)

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
    features: text("features", { mode: "json" }).$type<
      Record<string, number>
    >(),
    generatedAt: integer("generated_at")
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [index("similarity_artifacts_work_idx").on(table.workId)]
)
