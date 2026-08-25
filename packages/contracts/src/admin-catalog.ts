import { ageSchema, audienceSchema, riskLevelSchema } from "@arcadia/domain";
import { z } from "zod";
import {
  awardResultSchema,
  installmentKindSchema,
  installmentStatusSchema,
  scoreSchema,
  workflowStatusSchema,
} from "./enums";

/**
 * Canonical admin write-side (input) schemas for titles, installments, episodes, and award
 * ceremonies — the target validation this package didn't have before: `POST
 * /api/v1/admin/titles` currently accepts an unvalidated, hand-typed `AdminTitleInput` in
 * `apps/api/src/app.ts`. These schemas are meant to replace that local type (and the local
 * `adminStructureSchema` also in `app.ts`) so the same shape is validated on the server and
 * consumed by the web admin field registry (`admin-field-registry.ts`) to render forms.
 *
 * Field names intentionally match the READ-side schemas already exported from `index.ts`
 * (`adminTitleDetailSchema`, `installmentSchema`, `episodeSchema` — e.g. `canonicalTitle`,
 * `genres`, `tones`, not the web `Work` model's `title`/`tone`). Consumers migrating off the
 * legacy `AdminTitleInput` shape need a mapper; see the refactor plan for
 * `mapWorkToAdminTitleInput`.
 *
 * IMPORTANT: this module intentionally imports nothing from `./index` (only from
 * `@arcadia/domain` and the dependency-free `./enums`) so `index.ts` can safely
 * `export * from "./admin-catalog"` without a circular-import hazard.
 *
 * Genre/tone/tag/country values are deliberately left as open string arrays (not
 * `z.enum([...])`) — they are DB-backed, admin-editable vocabularies (see
 * `vocabularyNameSchema`/`/api/v1/admin/vocabularies`), not a fixed compile-time list. The write
 * path resolves them by slug/label lookup at request time; constraining them to
 * `@arcadia/domain`'s seed taxonomy here would reject any vocabulary term an admin added later.
 */

const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected an ISO calendar date (YYYY-MM-DD)");

const openVocabularyArray = z.array(z.string().trim().min(1)).default([]);

/**
 * The five typed external-catalog identifiers, present on both `titles` and `installments`
 * (see the player/torrent roadmap's "Database migration" section). Shared here so the read-side
 * schemas in `index.ts` and the write-side input schemas below stay in sync.
 */
export const externalIdFieldsSchema = z.object({
  tmdbId: z.number().int().positive().nullable(),
  imdbId: z
    .string()
    .regex(/^tt\d{7,10}$/)
    .nullable(),
  tvdbId: z.number().int().positive().nullable(),
  anilistId: z.number().int().positive().nullable(),
  malId: z.number().int().positive().nullable(),
});
export const externalIdFieldsInputSchema = z.object({
  tmdbId: z.number().int().positive().nullable().default(null),
  imdbId: z
    .string()
    .regex(/^tt\d{7,10}$/)
    .nullable()
    .default(null),
  tvdbId: z.number().int().positive().nullable().default(null),
  anilistId: z.number().int().positive().nullable().default(null),
  malId: z.number().int().positive().nullable().default(null),
});

export const adminEpisodeInputSchema = z.object({
  /** Omit to create a new episode; present + matching an existing row updates it. */
  id: z.string().uuid().optional(),
  number: z.number().positive(),
  position: z.number().int().min(0),
  title: z.string().trim().nullable().default(null),
  releaseDate: isoDateSchema.nullable().default(null),
  runtimeMinutes: z.number().int().min(0).nullable().default(null),
});

export const adminInstallmentInputSchema = z.object({
  /** Omit to create a new installment (season/movie/special); present updates it. */
  id: z.string().uuid().optional(),
  kind: installmentKindSchema.default("season"),
  title: z.string().trim().min(1),
  summary: z.string().default(""),
  status: installmentStatusSchema.default("unknown"),
  position: z.number().int().min(0),
  releaseDate: isoDateSchema.nullable().default(null),
  runtimeMinutes: z.number().int().min(0).nullable().default(null),
  posterPath: z.string().nullable().default(null),
  /** Per-installment classification overrides — null clears the override, absent leaves it as-is. */
  audienceOverride: audienceSchema.nullable().default(null),
  ageOverride: ageSchema.nullable().default(null),
  sexualityRiskOverride: riskLevelSchema.nullable().default(null),
  behavioralRiskOverride: riskLevelSchema.nullable().default(null),
  theologyRiskOverride: riskLevelSchema.nullable().default(null),
  score: scoreSchema.partial().optional(),
  episodes: z.array(adminEpisodeInputSchema).default([]),
  ...externalIdFieldsInputSchema.shape,
});

/**
 * Full-document replace payload for `PUT /api/v1/admin/titles/:titleId/structure` — promoted
 * from the local `adminStructureSchema` in `apps/api/src/app.ts`. Sending this payload deletes
 * every installment/episode for the title not represented here and reinserts the rest — omitting
 * an existing installment or episode deletes it (and, for installments, its episodes). This is
 * also the intended mechanism for creating new installments/episodes: include an entry with no
 * `id`.
 */
export const adminStructureInputSchema = z.object({
  installments: z.array(adminInstallmentInputSchema).min(1),
});

export const adminExternalIdentityInputSchema = z.object({
  provider: z.string().trim().min(1),
  externalId: z.string().trim().min(1),
  url: z.string().url().nullable().default(null),
});

export const adminTitleRelationInputSchema = z.object({
  titleId: z.string().uuid(),
  relationType: z.string().trim().min(1),
  direction: z.enum(["outgoing", "incoming"]),
  notes: z.string().default(""),
});

export const adminContributorInputSchema = z.object({
  entityId: z.string().uuid(),
  role: z.string().trim().min(1),
  isPrimary: z.boolean().default(false),
});

/**
 * Canonical title (umbrella record) input — replaces `AdminTitleInput` in `apps/api/src/app.ts`.
 *
 * Deliberately does NOT include `awards`: title-level award recognitions are no longer part of
 * a title's own save payload (per the confirmed refactor decision) — they flow exclusively
 * through `/api/v1/admin/awards/recognitions` (`adminAwardRecognitionInputSchema`), saved
 * immediately, independent of this schema. The old behavior — a full delete-then-reinsert of a
 * title's `award_recognitions` on every title save — is being retired specifically because it
 * silently overwrote awards edited elsewhere.
 *
 * Also does NOT include per-installment fields (`kind`/`status`/`runtimeMinutes`/`releaseDate`/
 * poster) — those belong to `adminInstallmentInputSchema` via the structure endpoint. The one
 * exception is `initialInstallment`, an optional convenience used only when creating a brand-new
 * title (no `id`) to seed its first installment, mirroring the "pick a kind up front" step of
 * today's add-work flow without conflating it with ongoing edits to an existing title.
 *
 * `verifiedByAccountId` is intentionally absent — the server derives it from the authenticated
 * session whenever `verifiedAt` changes; a curator must never be able to spoof who verified a
 * title.
 */
export const adminTitleInputSchema = z.object({
  id: z.string().uuid().optional(),
  canonicalTitle: z.string().trim().min(1),
  titleAr: z.string().trim().nullable().default(null),
  summary: z.string().default(""),
  contentWarnings: z.string().nullable().default(null),
  analysisNotes: z.string().nullable().default(null),
  releaseYear: z.number().int().min(1800).max(2200).nullable().default(null),
  isPrivate: z.boolean().default(false),

  audience: audienceSchema.default("general"),
  age: ageSchema.default("all"),
  sexualityRisk: riskLevelSchema.default("none"),
  behavioralRisk: riskLevelSchema.default("none"),
  theologyRisk: riskLevelSchema.default("none"),

  /** Preserves today's create-time default of "draft" (not the DB column's "published" default) — new titles should not be visible before review. */
  workflowStatus: workflowStatusSchema.default("draft"),
  qualityScore: z.number().int().min(0).default(0),
  curatorNotes: z.string().default(""),
  provenance: z.record(z.string(), z.unknown()).default({}),
  verifiedAt: z.string().datetime().nullable().default(null),

  aliases: z.array(z.string().trim().min(1)).default([]),
  genres: openVocabularyArray,
  tones: openVocabularyArray,
  tags: openVocabularyArray,
  countries: openVocabularyArray,
  planetId: z.string().uuid().nullable().default(null),

  contributors: z.array(adminContributorInputSchema).default([]),
  relations: z.array(adminTitleRelationInputSchema).default([]),
  externalIdentities: z.array(adminExternalIdentityInputSchema).default([]),
  ...externalIdFieldsInputSchema.shape,

  imagePath: z.string().nullable().default(null),
  bannerPath: z.string().nullable().default(null),
  logoPath: z.string().nullable().default(null),

  initialInstallment: z
    .object({
      kind: installmentKindSchema,
      status: installmentStatusSchema.default("unknown"),
      runtimeMinutes: z.number().int().min(0).nullable().default(null),
    })
    .optional(),
});

export const adminAwardCeremonyInputSchema = z.object({
  id: z.string().uuid().optional(),
  organizationId: z.string().uuid(),
  year: z.number().int().min(1900).max(2100),
  edition: z.number().int().positive().nullable().default(null),
  label: z.string().trim().default(""),
  heldOn: isoDateSchema.nullable().default(null),
  sourceUrl: z.string().url().nullable().default(null),
});

const bulkListOpSchema = z.object({
  add: z.array(z.string().trim().min(1)).default([]),
  remove: z.array(z.string().trim().min(1)).default([]),
});

/**
 * Award-recognition shape for the bulk "add to many" operation (Stage 3's apply-to-many
 * editor). Deliberately a local, minimal mirror of `adminAwardRecognitionInputSchema`'s fields
 * (minus `id`/`titleId`, which the bulk endpoint supplies per selected title) rather than an
 * import of that schema from `index.ts` — see the module-level note on why this file never
 * imports from `./index`. When Stage 3 is implemented, reconcile this against the real
 * recognition-creation validation in `apps/api/src/features/awards/routes.ts` (org/category
 * match, installment-belongs-to-title) so bulk-add enforces the same invariants as single-add.
 */
export const adminBulkAwardAdditionSchema = z.object({
  organizationId: z.string().uuid(),
  categoryId: z.string().uuid(),
  installmentId: z.string().uuid().nullable().default(null),
  year: z.number().int().min(1900).max(2100).nullable().default(null),
  result: awardResultSchema,
  isFeatured: z.boolean().default(false),
  sourceUrl: z.string().url().nullable().default(null),
  notes: z.string().max(4000).nullable().default(null),
});

/**
 * Payload for the not-yet-built `PATCH /api/v1/admin/titles/bulk` endpoint (Stage 3). One
 * endpoint, one discriminated payload, not four purpose-built ones — see the refactor plan for
 * the reasoning. Key *presence* in `scalars` means "set this for every selected title"; an
 * absent key means "leave unchanged" (no sentinel string, unlike the legacy `BulkEditDialog`'s
 * `"unchanged"`/`"unknown"` sentinels that this refactor is retiring).
 */
export const adminTitleBulkScalarPatchSchema = z.object({
  audience: audienceSchema.optional(),
  age: ageSchema.optional(),
  sexualityRisk: riskLevelSchema.optional(),
  behavioralRisk: riskLevelSchema.optional(),
  theologyRisk: riskLevelSchema.optional(),
  isPrivate: z.boolean().optional(),
  workflowStatus: workflowStatusSchema.optional(),
  planetId: z.string().uuid().nullable().optional(),
});

export const adminTitleBulkPatchSchema = z.object({
  titleIds: z.array(z.string().uuid()).min(1),
  scalars: adminTitleBulkScalarPatchSchema.default({}),
  lists: z
    .object({
      genres: bulkListOpSchema.optional(),
      tones: bulkListOpSchema.optional(),
      tags: bulkListOpSchema.optional(),
      countries: bulkListOpSchema.optional(),
    })
    .default({}),
  credits: z
    .object({
      add: z.array(adminContributorInputSchema).default([]),
      removeEntityIds: z.array(z.string().uuid()).default([]),
    })
    .default({ add: [], removeEntityIds: [] }),
  awards: z
    .object({
      add: z.array(adminBulkAwardAdditionSchema).default([]),
    })
    .default({ add: [] }),
});

export const adminTitleBulkPatchResultSchema = z.object({
  applied: z.number().int().min(0),
  failed: z.number().int().min(0),
  results: z.array(
    z.object({
      titleId: z.string().uuid(),
      status: z.enum(["ok", "error"]),
      message: z.string().optional(),
    }),
  ),
});

export type AdminEpisodeInput = z.infer<typeof adminEpisodeInputSchema>;
export type AdminInstallmentInput = z.infer<typeof adminInstallmentInputSchema>;
export type AdminStructureInput = z.infer<typeof adminStructureInputSchema>;
export type AdminTitleInput = z.infer<typeof adminTitleInputSchema>;
export type AdminAwardCeremonyInput = z.infer<typeof adminAwardCeremonyInputSchema>;
export type AdminTitleBulkPatch = z.infer<typeof adminTitleBulkPatchSchema>;
export type AdminTitleBulkPatchResult = z.infer<typeof adminTitleBulkPatchResultSchema>;
