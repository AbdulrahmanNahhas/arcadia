// Generated from openapi.json. Do not edit.
import { z } from "zod";

export const ErrorSchema = z.strictObject({
  message: z.string(),
});
export type Error = z.infer<typeof ErrorSchema>;

export const UserSchema = z.strictObject({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  role: z.enum(["owner"]),
});
export type User = z.infer<typeof UserSchema>;

export const LoginRequestSchema = z.strictObject({
  email: z.string(),
  password: z.string().min(1).max(1024),
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const SessionSchema = z.strictObject({
  user: UserSchema,
  expiresAt: z.string(),
});
export type Session = z.infer<typeof SessionSchema>;

export const LoginResponseSchema = z.strictObject({
  token: z.string(),
  user: UserSchema,
  expiresAt: z.string(),
});
export type LoginResponse = z.infer<typeof LoginResponseSchema>;

export const ArtworkSchema = z.strictObject({
  id: z.string().uuid(),
  url: z.string(),
  mimeType: z.string(),
  width: z.number().int(),
  height: z.number().int(),
  byteSize: z.number().int(),
  sha256: z.string(),
  originalFilename: z.string(),
  focalX: z.number().int(),
  focalY: z.number().int(),
});
export type Artwork = z.infer<typeof ArtworkSchema>;

export const ArtworkAssignmentSchema = z.strictObject({
  id: z.string().uuid(),
  url: z.string(),
  mimeType: z.string(),
  width: z.number().int(),
  height: z.number().int(),
  role: z.enum(["poster", "banner", "logo", "profile"]),
  isPrimary: z.boolean(),
  byteSize: z.number().int(),
  sha256: z.string(),
  originalFilename: z.string(),
  focalX: z.number().int(),
  focalY: z.number().int(),
});
export type ArtworkAssignment = z.infer<typeof ArtworkAssignmentSchema>;

export const VocabularySchema = z.strictObject({
  id: z.string().uuid(),
  slug: z.string(),
  labelEn: z.string(),
  labelAr: z.string(),
  descriptionEn: z.string(),
  descriptionAr: z.string(),
});
export type Vocabulary = z.infer<typeof VocabularySchema>;

export const ExternalIdsSchema = z.strictObject({
  tmdbId: z.number().int().nullable(),
  imdbId: z.string().nullable(),
  anilistId: z.number().int().nullable(),
  malId: z.number().int().nullable(),
});
export type ExternalIds = z.infer<typeof ExternalIdsSchema>;

export const ScoresSchema = z.strictObject({
  story: z.number().nullable(),
  characters: z.number().nullable(),
  depth: z.number().nullable(),
  worldBuilding: z.number().nullable(),
  originality: z.number().nullable(),
  craft: z.number().nullable(),
  updatedAt: z.string(),
});
export type Scores = z.infer<typeof ScoresSchema>;

export const ClassificationSchema = z.strictObject({
  audience: z.enum(["general", "teen", "young-adult", "adult"]),
  age: z.string(),
  sexualityRisk: z.enum(["none", "low", "medium", "high"]),
  behavioralRisk: z.enum(["none", "low", "medium", "high"]),
  theologyRisk: z.enum(["none", "low", "medium", "high"]),
});
export type Classification = z.infer<typeof ClassificationSchema>;

export const MediaTrackSchema = z.strictObject({
  id: z.string().uuid(),
  kind: z.enum(["video", "audio", "subtitle"]),
  streamIndex: z.number().int(),
  language: z.string().nullable(),
  codec: z.string().nullable(),
  title: z.string().nullable(),
  isDefault: z.boolean(),
  isForced: z.boolean(),
});
export type MediaTrack = z.infer<typeof MediaTrackSchema>;

export const MediaFileSchema = z.strictObject({
  id: z.string().uuid(),
  durationSeconds: z.number().int().nullable(),
  jellyfinLinked: z.boolean(),
  tracks: z.array(MediaTrackSchema),
});
export type MediaFile = z.infer<typeof MediaFileSchema>;

export const EpisodeSchema = z.strictObject({
  id: z.string().uuid(),
  number: z.string(),
  position: z.number().int(),
  title: z.string().nullable(),
  summary: z.string(),
  releaseDate: z.string().nullable(),
  runtimeMinutes: z.number().int().nullable(),
  releaseState: z.enum(["unknown", "upcoming", "released"]),
  hasMediaFile: z.boolean(),
  classification: ClassificationSchema,
  artwork: z.array(ArtworkAssignmentSchema),
  mediaFiles: z.array(MediaFileSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Episode = z.infer<typeof EpisodeSchema>;

export const ClassificationOverridesSchema = z.strictObject({
  audience: z.enum(["general", "teen", "young-adult", "adult"]).nullable(),
  age: z.string().nullable(),
  sexualityRisk: z.enum(["none", "low", "medium", "high"]).nullable(),
  behavioralRisk: z.enum(["none", "low", "medium", "high"]).nullable(),
  theologyRisk: z.enum(["none", "low", "medium", "high"]).nullable(),
});
export type ClassificationOverrides = z.infer<typeof ClassificationOverridesSchema>;

export const ExternalReferenceSchema = z.strictObject({
  id: z.string().uuid(),
  provider: z.string(),
  externalId: z.string(),
  url: z.string().nullable(),
});
export type ExternalReference = z.infer<typeof ExternalReferenceSchema>;

export const InstallmentSchema = z.strictObject({
  id: z.string().uuid(),
  kind: z.enum(["season", "movie", "special"]),
  position: z.number().int(),
  title: z.string(),
  summary: z.string(),
  releaseDate: z.string().nullable(),
  runtimeMinutes: z.number().int().nullable(),
  status: z.enum(["announced", "airing", "completed", "unknown"]),
  externalIds: ExternalIdsSchema,
  scores: ScoresSchema.nullable(),
  hasMediaFile: z.boolean(),
  artwork: z.array(ArtworkAssignmentSchema),
  episodes: z.array(EpisodeSchema),
  classification: ClassificationSchema,
  classificationOverrides: ClassificationOverridesSchema,
  releaseState: z.enum(["unknown", "upcoming", "released"]),
  externalReferences: z.array(ExternalReferenceSchema),
  mediaFiles: z.array(MediaFileSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Installment = z.infer<typeof InstallmentSchema>;

export const ScoreSummarySchema = z.strictObject({
  rating: z.number().nullable(),
  scored: z.number().int(),
  total: z.number().int(),
});
export type ScoreSummary = z.infer<typeof ScoreSummarySchema>;

export const WorkSummarySchema = z.strictObject({
  id: z.string().uuid(),
  canonicalTitle: z.string(),
  titleAr: z.string().nullable(),
  summary: z.string(),
  releaseYear: z.number().int().nullable(),
  format: z.enum(["animated", "live-action"]),
  audience: z.enum(["general", "teen", "young-adult", "adult"]),
  age: z.string(),
  poster: ArtworkSchema.nullable(),
  installmentCount: z.number().int(),
  episodeCount: z.number().int(),
  isPrivate: z.boolean(),
  score: ScoreSummarySchema,
});
export type WorkSummary = z.infer<typeof WorkSummarySchema>;

export const AliasSchema = z.strictObject({
  title: z.string(),
  language: z.string().nullable(),
  isPreferred: z.boolean(),
  id: z.string().uuid(),
  script: z.string().nullable(),
});
export type Alias = z.infer<typeof AliasSchema>;

export const EntityAliasSchema = z.strictObject({
  alias: z.string(),
  language: z.string().nullable(),
});
export type EntityAlias = z.infer<typeof EntityAliasSchema>;

export const ContributionSchema = z.strictObject({
  id: z.string().uuid(),
  name: z.string(),
  kind: z.string(),
  role: z.string(),
  roleLabelEn: z.string(),
  roleLabelAr: z.string(),
  description: z.string(),
  aliases: z.array(EntityAliasSchema),
  artwork: z.array(ArtworkAssignmentSchema),
  isPrimary: z.boolean(),
  position: z.number().int(),
  roleId: z.string().uuid(),
  roleDescriptionEn: z.string(),
  roleDescriptionAr: z.string(),
});
export type Contribution = z.infer<typeof ContributionSchema>;

export const RelationSchema = z.strictObject({
  id: z.string().uuid(),
  workId: z.string().uuid(),
  canonicalTitle: z.string(),
  titleAr: z.string().nullable(),
  kind: z.string(),
  direction: z.enum(["outgoing", "incoming"]),
  notes: z.string(),
});
export type Relation = z.infer<typeof RelationSchema>;

export const PlanetSchema = z.strictObject({
  id: z.string().uuid(),
  slug: z.string(),
  nameAr: z.string(),
  nameEn: z.string().nullable(),
  icon: z.string(),
  description: z.string(),
  primaryColor: z.string(),
  secondaryColor: z.string(),
  featuredRank: z.number().int().nullable(),
});
export type Planet = z.infer<typeof PlanetSchema>;

export const AwardOrganizationSchema = z.strictObject({
  id: z.string().uuid(),
  slug: z.string(),
  nameAr: z.string(),
  nameEn: z.string().nullable(),
  description: z.string(),
  websiteUrl: z.string().nullable(),
});
export type AwardOrganization = z.infer<typeof AwardOrganizationSchema>;

export const AwardCategorySchema = z.strictObject({
  id: z.string().uuid(),
  slug: z.string(),
  nameAr: z.string(),
  nameEn: z.string().nullable(),
  description: z.string(),
});
export type AwardCategory = z.infer<typeof AwardCategorySchema>;

export const AwardCeremonySchema = z.strictObject({
  id: z.string().uuid(),
  year: z.number().int(),
  edition: z.number().int().nullable(),
  label: z.string(),
  heldOn: z.string().nullable(),
  sourceUrl: z.string().nullable(),
});
export type AwardCeremony = z.infer<typeof AwardCeremonySchema>;

export const AwardRecognitionSchema = z.strictObject({
  id: z.string().uuid(),
  installmentId: z.string().uuid().nullable(),
  organizationSlug: z.string(),
  organizationName: z.string(),
  category: z.string(),
  year: z.number().int().nullable(),
  result: z.enum(["winner", "nominee"]),
  isFeatured: z.boolean(),
  sourceUrl: z.string().nullable(),
  notes: z.string().nullable(),
  position: z.number().int(),
  organization: AwardOrganizationSchema.nullable(),
  awardCategory: AwardCategorySchema.nullable(),
  ceremony: AwardCeremonySchema.nullable(),
});
export type AwardRecognition = z.infer<typeof AwardRecognitionSchema>;

export const WorkDetailSchema = z.strictObject({
  id: z.string().uuid(),
  canonicalTitle: z.string(),
  titleAr: z.string().nullable(),
  summary: z.string(),
  releaseYear: z.number().int().nullable(),
  format: z.enum(["animated", "live-action"]),
  audience: z.enum(["general", "teen", "young-adult", "adult"]),
  age: z.string(),
  poster: ArtworkSchema.nullable(),
  installmentCount: z.number().int(),
  episodeCount: z.number().int(),
  contentWarnings: z.string().nullable(),
  analysisNotes: z.string().nullable(),
  sexualityRisk: z.string(),
  behavioralRisk: z.string(),
  theologyRisk: z.string(),
  externalIds: ExternalIdsSchema,
  aliases: z.array(AliasSchema),
  trivia: z.array(z.string()),
  genres: z.array(VocabularySchema),
  contributions: z.array(ContributionSchema),
  relations: z.array(RelationSchema),
  artwork: z.array(ArtworkAssignmentSchema),
  installments: z.array(InstallmentSchema),
  curatorNotes: z.string(),
  qualityScore: z.number().int(),
  verifiedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  externalReferences: z.array(ExternalReferenceSchema),
  tones: z.array(VocabularySchema),
  tags: z.array(VocabularySchema),
  countries: z.array(VocabularySchema),
  planets: z.array(PlanetSchema),
  awards: z.array(AwardRecognitionSchema),
  sortTitle: z.string(),
  isPrivate: z.boolean(),
  score: ScoreSummarySchema,
});
export type WorkDetail = z.infer<typeof WorkDetailSchema>;

export const WorkPageSchema = z.strictObject({
  items: z.array(WorkSummarySchema),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
});
export type WorkPage = z.infer<typeof WorkPageSchema>;

export const CatalogPlanetSchema = z.strictObject({
  id: z.string().uuid(),
  slug: z.string(),
  nameAr: z.string(),
  nameEn: z.string().nullable(),
  icon: z.string(),
  count: z.number().int(),
});
export type CatalogPlanet = z.infer<typeof CatalogPlanetSchema>;

export const CatalogFiltersSchema = z.strictObject({
  genres: z.array(VocabularySchema),
  formats: z.array(z.string()),
  audiences: z.array(z.string()),
  statuses: z.array(z.string()),
  yearMin: z.number().int().nullable(),
  yearMax: z.number().int().nullable(),
  planets: z.array(CatalogPlanetSchema),
});
export type CatalogFilters = z.infer<typeof CatalogFiltersSchema>;

export const FamilyActivitySchema = z.strictObject({
  id: z.string().uuid(),
  kind: z.enum(["comment", "review"]),
  body: z.string(),
  containsSpoilers: z.boolean(),
  rating: z.number().int().nullable(),
  createdAt: z.string(),
  authorName: z.string(),
  avatarKey: z.string(),
  work: WorkSummarySchema,
});
export type FamilyActivity = z.infer<typeof FamilyActivitySchema>;

export const UpcomingInstallmentSchema = z.strictObject({
  id: z.string().uuid(),
  workId: z.string().uuid(),
  workTitle: z.string(),
  workTitleAr: z.string().nullable(),
  title: z.string(),
  kind: z.enum(["season", "movie", "special"]),
  releaseDate: z.string().nullable(),
  runtimeMinutes: z.number().int().nullable(),
  episodeCount: z.number().int(),
  poster: ArtworkSchema.nullable(),
  score: ScoreSummarySchema,
});
export type UpcomingInstallment = z.infer<typeof UpcomingInstallmentSchema>;

export const HomeFeedSchema = z.strictObject({
  comments: z.array(FamilyActivitySchema),
  upcoming: z.array(UpcomingInstallmentSchema),
});
export type HomeFeed = z.infer<typeof HomeFeedSchema>;

export class ApiClient {
  private readonly baseUrl: string;
  private readonly token: () => string | null;
  constructor(baseUrl: string, token: () => string | null) {
    this.baseUrl = baseUrl;
    this.token = token;
  }
  private async request(
    path: string,
    method: string,
    body?: LoginRequest,
    signal?: AbortSignal,
  ): Promise<Response> {
    const headers = new Headers();
    const token = this.token();
    if (token) headers.set("Authorization", `Bearer ${token}`);
    if (body !== undefined) headers.set("Content-Type", "application/json");
    const response = await fetch(`${this.baseUrl.replace(/\/$/, "")}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
    if (!response.ok) throw new globalThis.Error(`API request failed (${response.status})`);
    return response;
  }
  async login(body: LoginRequest, signal?: AbortSignal): Promise<LoginResponse> {
    const response = await this.request("/api/v1/auth/login", "POST", body, signal);
    return LoginResponseSchema.parse(await response.json());
  }
  async getSession(signal?: AbortSignal): Promise<Session> {
    const response = await this.request("/api/v1/auth/session", "GET", undefined, signal);
    return SessionSchema.parse(await response.json());
  }
  async logout(signal?: AbortSignal): Promise<void> {
    const response = await this.request("/api/v1/auth/logout", "POST", undefined, signal);
    if (response.status !== 204) throw new globalThis.Error("Invalid logout response");
  }
  async listWorks(
    query: {
      page?: number;
      pageSize?: number;
      q?: string;
      sort?: "title" | "year-desc" | "year-asc" | "updated-desc" | "added-desc";
      format?: "animated" | "live-action";
      audience?: "general" | "teen" | "young-adult" | "adult";
      genre?: string;
      status?: "announced" | "airing" | "completed" | "unknown";
      yearFrom?: number;
      yearTo?: number;
      includePrivate?: boolean;
      planet?: string;
    } = {},
    signal?: AbortSignal,
  ): Promise<WorkPage> {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query))
      if (value !== undefined) params.set(key, String(value));
    const response = await this.request(
      "/api/v1/works" + (params.size ? `?${params}` : ""),
      "GET",
      undefined,
      signal,
    );
    return WorkPageSchema.parse(await response.json());
  }
  async getWork(id: string, signal?: AbortSignal): Promise<WorkDetail> {
    const response = await this.request(
      `/api/v1/works/${encodeURIComponent(id)}`,
      "GET",
      undefined,
      signal,
    );
    return WorkDetailSchema.parse(await response.json());
  }
  async getCatalogFilters(signal?: AbortSignal): Promise<CatalogFilters> {
    const response = await this.request("/api/v1/catalog/filters", "GET", undefined, signal);
    return CatalogFiltersSchema.parse(await response.json());
  }
  async getHomeFeed(signal?: AbortSignal): Promise<HomeFeed> {
    const response = await this.request("/api/v1/catalog/home", "GET", undefined, signal);
    return HomeFeedSchema.parse(await response.json());
  }
}
