import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const audienceEnum = pgEnum("audience", ["general", "teen", "young-adult", "adult"]);
export const ageEnum = pgEnum("age_rating", ["all", "7+", "10+", "13+", "16+", "18+"]);
export const riskEnum = pgEnum("risk_level", ["none", "low", "medium", "high"]);
export const installmentKindEnum = pgEnum("installment_kind", ["season", "movie", "special"]);
export const releaseStatusEnum = pgEnum("release_status", [
  "announced",
  "airing",
  "completed",
  "unknown",
]);
export const entityKindEnum = pgEnum("entity_kind", ["person", "organization"]);
export const accountKindEnum = pgEnum("account_kind", ["admin", "family", "individual"]);
export const trackKindEnum = pgEnum("track_kind", ["video", "audio", "subtitle"]);
export const relationKindEnum = pgEnum("title_relation_kind", [
  "sequel",
  "adaptation",
  "spin-off",
  "side-story",
  "compilation",
  "alternative",
  "related",
]);

const id = { id: uuid("id").primaryKey().defaultRandom() };
const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};
const classificationDefaults = {
  audience: audienceEnum("audience").notNull().default("general"),
  age: ageEnum("age").notNull().default("all"),
  sexualityRisk: riskEnum("sexuality_risk").notNull().default("none"),
  behavioralRisk: riskEnum("behavioral_risk").notNull().default("none"),
  theologyRisk: riskEnum("theology_risk").notNull().default("none"),
};

export const titles = pgTable(
  "titles",
  {
    ...id,
    canonicalTitle: text("canonical_title").notNull(),
    sortTitle: text("sort_title").notNull(),
    titleAr: text("title_ar"),
    summary: text("summary").notNull().default(""),
    contentWarnings: text("content_warnings"),
    analysisNotes: text("analysis_notes"),
    releaseYear: integer("release_year"),
    posterPath: text("poster_path"),
    bannerPath: text("banner_path"),
    logoPath: text("logo_path"),
    isPrivate: boolean("is_private").notNull().default(false),
    ...classificationDefaults,
    ...timestamps,
  },
  (t) => [
    index("titles_sort_idx").on(t.sortTitle),
    index("titles_release_year_idx").on(t.releaseYear),
    index("titles_search_trgm_idx").using("gin", sql`${t.canonicalTitle} gin_trgm_ops`),
  ],
);
export const titleAliases = pgTable(
  "title_aliases",
  {
    ...id,
    titleId: uuid("title_id")
      .notNull()
      .references(() => titles.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    language: text("language"),
    script: text("script"),
    isPreferred: boolean("is_preferred").notNull().default(false),
  },
  (t) => [
    uniqueIndex("title_alias_identity_uq").on(t.titleId, t.title, t.language),
    uniqueIndex("title_alias_normalized_identity_uq").on(t.titleId, sql`lower(btrim(${t.title}))`),
    index("title_alias_search_trgm_idx").using("gin", sql`${t.title} gin_trgm_ops`),
  ],
);

export const installments = pgTable(
  "installments",
  {
    ...id,
    titleId: uuid("title_id")
      .notNull()
      .references(() => titles.id, { onDelete: "cascade" }),
    kind: installmentKindEnum("kind").notNull(),
    position: integer("position").notNull(),
    title: text("title").notNull(),
    summary: text("summary").notNull().default(""),
    releaseDate: date("release_date"),
    runtimeMinutes: integer("runtime_minutes"),
    status: releaseStatusEnum("status").notNull().default("unknown"),
    posterPath: text("poster_path"),
    audienceOverride: audienceEnum("audience_override"),
    ageOverride: ageEnum("age_override"),
    sexualityRiskOverride: riskEnum("sexuality_risk_override"),
    behavioralRiskOverride: riskEnum("behavioral_risk_override"),
    theologyRiskOverride: riskEnum("theology_risk_override"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("installments_title_position_uq").on(t.titleId, t.position),
    check(
      "installments_values_check",
      sql`${t.position} >= 0 and (${t.runtimeMinutes} is null or ${t.runtimeMinutes} >= 0)`,
    ),
  ],
);
export const episodes = pgTable(
  "episodes",
  {
    ...id,
    installmentId: uuid("installment_id")
      .notNull()
      .references(() => installments.id, { onDelete: "cascade" }),
    number: numeric("number", { precision: 8, scale: 2 }).notNull(),
    position: integer("position").notNull(),
    title: text("title"),
    releaseDate: date("release_date"),
    runtimeMinutes: integer("runtime_minutes"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("episodes_installment_position_uq").on(t.installmentId, t.position),
    check(
      "episodes_values_check",
      sql`${t.position} >= 0 and (${t.runtimeMinutes} is null or ${t.runtimeMinutes} >= 0)`,
    ),
  ],
);
export const installmentScores = pgTable(
  "installment_scores",
  {
    installmentId: uuid("installment_id")
      .primaryKey()
      .references(() => installments.id, { onDelete: "cascade" }),
    story: numeric("story", { precision: 3, scale: 1 }),
    characters: numeric("characters", { precision: 3, scale: 1 }),
    depth: numeric("depth", { precision: 3, scale: 1 }),
    worldBuilding: numeric("world_building", { precision: 3, scale: 1 }),
    originality: numeric("originality", { precision: 3, scale: 1 }),
    craft: numeric("craft", { precision: 3, scale: 1 }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check(
      "installment_scores_range_check",
      sql`(${t.story} is null or ${t.story} between 0 and 10) and (${t.characters} is null or ${t.characters} between 0 and 10) and (${t.depth} is null or ${t.depth} between 0 and 10) and (${t.worldBuilding} is null or ${t.worldBuilding} between 0 and 10) and (${t.originality} is null or ${t.originality} between 0 and 10) and (${t.craft} is null or ${t.craft} between 0 and 10)`,
    ),
  ],
);

function lookup(name: string) {
  return pgTable(name, {
    ...id,
    slug: text("slug").notNull().unique(),
    labelEn: text("label_en").notNull(),
    labelAr: text("label_ar").notNull(),
    position: integer("position").notNull().default(0),
  });
}
export const genres = lookup("genres");
export const tones = lookup("tones");
export const tags = lookup("tags");
export const countries = lookup("countries");
export const roles = lookup("roles");
function titleLookup(name: string, table: ReturnType<typeof lookup>) {
  return pgTable(
    name,
    {
      titleId: uuid("title_id")
        .notNull()
        .references(() => titles.id, { onDelete: "cascade" }),
      valueId: uuid("value_id")
        .notNull()
        .references(() => table.id, { onDelete: "restrict" }),
    },
    (t) => [primaryKey({ columns: [t.titleId, t.valueId] })],
  );
}
export const titleGenres = titleLookup("title_genres", genres);
export const titleTones = titleLookup("title_tones", tones);
export const titleTags = titleLookup("title_tags", tags);
export const titleCountries = titleLookup("title_countries", countries);

export const planets = pgTable("planets", {
  ...id,
  slug: text("slug").notNull().unique(),
  nameAr: text("name_ar").notNull(),
  nameEn: text("name_en"),
  icon: text("icon").notNull(),
  description: text("description").notNull().default(""),
  primaryColor: text("primary_color").notNull(),
  secondaryColor: text("secondary_color").notNull(),
  displayOrder: integer("display_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  ...timestamps,
});
export const titlePlanets = pgTable(
  "title_planets",
  {
    titleId: uuid("title_id")
      .notNull()
      .references(() => titles.id, { onDelete: "cascade" }),
    planetId: uuid("planet_id")
      .notNull()
      .references(() => planets.id, { onDelete: "restrict" }),
    featuredRank: integer("featured_rank"),
  },
  (t) => [primaryKey({ columns: [t.titleId, t.planetId] })],
);

export const entities = pgTable(
  "entities",
  {
    ...id,
    kind: entityKindEnum("kind").notNull(),
    name: text("name").notNull(),
    sortName: text("sort_name").notNull(),
    description: text("description").notNull().default(""),
    profilePath: text("profile_path"),
    ...timestamps,
  },
  (t) => [uniqueIndex("entities_kind_sort_uq").on(t.kind, t.sortName)],
);
export const entityAliases = pgTable("entity_aliases", {
  ...id,
  entityId: uuid("entity_id")
    .notNull()
    .references(() => entities.id, { onDelete: "cascade" }),
  alias: text("alias").notNull(),
  language: text("language"),
});
export const contributions = pgTable(
  "contributions",
  {
    titleId: uuid("title_id")
      .notNull()
      .references(() => titles.id, { onDelete: "cascade" }),
    entityId: uuid("entity_id")
      .notNull()
      .references(() => entities.id, { onDelete: "cascade" }),
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "restrict" }),
    position: integer("position").notNull().default(0),
    isPrimary: boolean("is_primary").notNull().default(false),
  },
  (t) => [primaryKey({ columns: [t.titleId, t.entityId, t.roleId] })],
);
export const organizationRelations = pgTable(
  "organization_relations",
  {
    ...id,
    sourceId: uuid("source_id")
      .notNull()
      .references(() => entities.id, { onDelete: "cascade" }),
    targetId: uuid("target_id")
      .notNull()
      .references(() => entities.id, { onDelete: "cascade" }),
    relationType: text("relation_type").notNull(),
    occurredOn: date("occurred_on"),
    description: text("description").notNull().default(""),
  },
  (t) => [check("organization_relation_distinct_check", sql`${t.sourceId} <> ${t.targetId}`)],
);
export const titleRelations = pgTable(
  "title_relations",
  {
    ...id,
    sourceTitleId: uuid("source_title_id")
      .notNull()
      .references(() => titles.id, { onDelete: "cascade" }),
    targetTitleId: uuid("target_title_id")
      .notNull()
      .references(() => titles.id, { onDelete: "cascade" }),
    kind: relationKindEnum("kind").notNull(),
    notes: text("notes").notNull().default(""),
  },
  (t) => [
    uniqueIndex("title_relations_pair_kind_uq").on(t.sourceTitleId, t.targetTitleId, t.kind),
    check("title_relations_distinct_check", sql`${t.sourceTitleId} <> ${t.targetTitleId}`),
  ],
);
export const externalIdentities = pgTable(
  "external_identities",
  {
    ...id,
    ownerType: text("owner_type").notNull(),
    ownerId: uuid("owner_id").notNull(),
    provider: text("provider").notNull(),
    externalId: text("external_id").notNull(),
    url: text("url"),
  },
  (t) => [uniqueIndex("external_identity_provider_uq").on(t.provider, t.externalId)],
);
export const artwork = pgTable("artwork", {
  ...id,
  ownerType: text("owner_type").notNull(),
  ownerId: uuid("owner_id").notNull(),
  kind: text("kind").notNull(),
  relativePath: text("relative_path").notNull(),
  mimeType: text("mime_type").notNull(),
  width: integer("width"),
  height: integer("height"),
});

export const accounts = pgTable("accounts", {
  ...id,
  kind: accountKindEnum("kind").notNull(),
  displayName: text("display_name").notNull(),
  invitedAt: timestamp("invited_at", { withTimezone: true }).notNull().defaultNow(),
  ...timestamps,
});
export const viewerProfiles = pgTable(
  "viewer_profiles",
  {
    ...id,
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    avatar: text("avatar"),
    ...timestamps,
  },
  (t) => [uniqueIndex("viewer_profiles_account_uq").on(t.accountId)],
);
export const profilePreferences = pgTable("profile_preferences", {
  profileId: uuid("profile_id")
    .primaryKey()
    .references(() => viewerProfiles.id, { onDelete: "cascade" }),
  locale: text("locale").notNull().default("ar"),
  theme: text("theme").notNull().default("dark"),
  preferredAudio: text("preferred_audio").array().notNull().default(sql`ARRAY['ar']::text[]`),
  allowedAudio: text("allowed_audio").array().notNull().default(sql`ARRAY['ar','en']::text[]`),
  subtitleMode: text("subtitle_mode").notNull().default("allowed"),
  canSwitchTracks: boolean("can_switch_tracks").notNull().default(true),
});
export const profileContentPolicies = pgTable("profile_content_policies", {
  profileId: uuid("profile_id")
    .primaryKey()
    .references(() => viewerProfiles.id, { onDelete: "cascade" }),
  ...classificationDefaults,
  inclusionFilter: jsonb("inclusion_filter"),
});
export const profileAdminRestrictions = pgTable("profile_admin_restrictions", {
  profileId: uuid("profile_id")
    .primaryKey()
    .references(() => viewerProfiles.id, { onDelete: "cascade" }),
  ...classificationDefaults,
  notes: text("notes").notNull().default(""),
});
export const profileTitleBlocks = pgTable(
  "profile_title_blocks",
  {
    profileId: uuid("profile_id")
      .notNull()
      .references(() => viewerProfiles.id, { onDelete: "cascade" }),
    titleId: uuid("title_id")
      .notNull()
      .references(() => titles.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.profileId, t.titleId] })],
);
export const profilePlaybackStates = pgTable(
  "profile_playback_states",
  {
    profileId: uuid("profile_id")
      .notNull()
      .references(() => viewerProfiles.id, { onDelete: "cascade" }),
    installmentId: uuid("installment_id")
      .notNull()
      .references(() => installments.id, { onDelete: "cascade" }),
    episodeId: uuid("episode_id").references(() => episodes.id, { onDelete: "cascade" }),
    positionSeconds: integer("position_seconds").notNull().default(0),
    completed: boolean("completed").notNull().default(false),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.profileId, t.installmentId] }),
    check("playback_position_check", sql`${t.positionSeconds} >= 0`),
  ],
);

export const mediaFiles = pgTable(
  "media_files",
  {
    ...id,
    installmentId: uuid("installment_id").references(() => installments.id, {
      onDelete: "cascade",
    }),
    episodeId: uuid("episode_id").references(() => episodes.id, { onDelete: "cascade" }),
    path: text("path").notNull(),
    durationSeconds: integer("duration_seconds"),
    probeVersion: text("probe_version"),
    ...timestamps,
  },
  (t) => [
    check(
      "media_file_single_owner_check",
      sql`num_nonnulls(${t.installmentId}, ${t.episodeId}) = 1`,
    ),
  ],
);
export const mediaTracks = pgTable(
  "media_tracks",
  {
    ...id,
    mediaFileId: uuid("media_file_id")
      .notNull()
      .references(() => mediaFiles.id, { onDelete: "cascade" }),
    kind: trackKindEnum("kind").notNull(),
    streamIndex: integer("stream_index").notNull(),
    language: text("language"),
    codec: text("codec"),
    title: text("title"),
    isDefault: boolean("is_default").notNull().default(false),
    isForced: boolean("is_forced").notNull().default(false),
  },
  (t) => [uniqueIndex("media_tracks_stream_uq").on(t.mediaFileId, t.streamIndex)],
);
export const jellyfinServers = pgTable("jellyfin_servers", {
  ...id,
  name: text("name").notNull(),
  baseUrl: text("base_url").notNull(),
  externalServerId: text("external_server_id"),
  ...timestamps,
});
export const jellyfinItems = pgTable(
  "jellyfin_items",
  {
    ...id,
    serverId: uuid("server_id")
      .notNull()
      .references(() => jellyfinServers.id, { onDelete: "cascade" }),
    mediaFileId: uuid("media_file_id").references(() => mediaFiles.id, { onDelete: "set null" }),
    externalItemId: text("external_item_id").notNull(),
    etag: text("etag"),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("jellyfin_item_external_uq").on(t.serverId, t.externalItemId)],
);

export const titlesRelations = relations(titles, ({ many }) => ({
  installments: many(installments),
  aliases: many(titleAliases),
}));
export const installmentsRelations = relations(installments, ({ one, many }) => ({
  title: one(titles, { fields: [installments.titleId], references: [titles.id] }),
  episodes: many(episodes),
  score: one(installmentScores),
}));
