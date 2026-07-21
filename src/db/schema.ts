import { sql } from "drizzle-orm"
import {
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
  (table) => [index("work_titles_work_idx").on(table.workId)]
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
    characterName: text("character_name"),
    position: integer("position").notNull().default(0),
    details: text("details", { mode: "json" }).$type<Record<string, unknown>>(),
  },
  (table) => [
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
    replayCount: integer("replay_count").notNull().default(0),
    notes: text("notes").notNull().default(""),
    privateMetadata: text("private_metadata", { mode: "json" })
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    ...timestamps,
  },
  (table) => [index("personal_state_status_idx").on(table.status)]
)

export const historyEvents = sqliteTable(
  "history_events",
  {
    id: text("id").primaryKey(),
    workId: text("work_id")
      .notNull()
      .references(() => works.id, { onDelete: "cascade" }),
    eventType: text("event_type").notNull(),
    occurredAt: integer("occurred_at").notNull(),
    progressBefore: real("progress_before"),
    progressAfter: real("progress_after"),
    durationMinutes: integer("duration_minutes"),
    notes: text("notes").notNull().default(""),
    payload: text("payload", { mode: "json" }).$type<Record<string, unknown>>(),
  },
  (table) => [
    index("history_events_work_date_idx").on(table.workId, table.occurredAt),
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
      .$type<FilterNode>()
      .notNull(),
    sort: text("sort", { mode: "json" })
      .$type<Array<{ field: string; direction: "asc" | "desc" }>>()
      .notNull()
      .default([]),
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
  (table) => [index("saved_views_pinned_idx").on(table.isPinned)]
)

export const externalLinks = sqliteTable(
  "external_links",
  {
    id: text("id").primaryKey(),
    ownerType: text("owner_type").notNull(),
    ownerId: text("owner_id").notNull(),
    provider: text("provider").notNull(),
    url: text("url").notNull(),
    externalId: text("external_id"),
    metadata: text("metadata", { mode: "json" }).$type<
      Record<string, unknown>
    >(),
  },
  (table) => [
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
