import { type AdminTitleInput, adminTitleInputSchema } from "@arcadia/contracts";
import type { database } from "../../database";

type Sql = ReturnType<typeof database>["client"];

/**
 * The shape the web admin client still sends today (the `Work`-shaped payload built by
 * `WorkEditorFormFields`/`saveWork`) — kept local rather than exported, since it is legacy and
 * meant to shrink as Stage 2 migrates the client onto `AdminTitleInput`'s field names directly.
 * `legacyTitleInputToCanonical` is the one place that understands this shape.
 */
export type LegacyTitleWritePayload = Partial<{
  id: string;
  title: string;
  canonicalTitle: string;
  arabicTitle: string | null;
  summary: string;
  contentWarnings: string | null;
  analysisNotes: string | null;
  year: number | null;
  isPrivate: boolean;
  audience: string | null;
  riskProfile: Partial<Record<"sexuality" | "behavioral" | "theology", string>> | null;
  aliases: string[];
  genres: string[];
  tone: string[];
  tags: string[];
  country: string[];
  planetId: string | null;
  contributors: Array<{ entityId: string; role: string; isPrimary?: boolean }>;
  relations: Array<{
    workId: string;
    relationType: string;
    direction: "outgoing" | "incoming";
    notes?: string;
  }>;
  externalLinks: Array<{ provider: string; label: string; url: string }>;
  /**
   * @deprecated Superseded by the direct fields below (`workflowStatus`/`curatorNotes`/
   * `verifiedAt`) — this two-state proxy is still accepted as a fallback (only consulted when
   * the direct fields are absent) for any caller that hasn't migrated off it yet.
   */
  curation: { reviewedAt: string; status: "verified" | "provisional"; notes: string | null } | null;
  age: AdminTitleInput["age"];
  workflowStatus: AdminTitleInput["workflowStatus"];
  qualityScore: number;
  curatorNotes: string;
  verifiedAt: string | null;
  imagePath: string | null;
  bannerPath: string | null;
  logoPath: string | null;
}>;

/** Columns `legacyTitleInputToCanonical` falls back to preserving from the current row when the caller sends neither the direct field nor (for workflow/verification) the legacy `curation` object. */
export interface PreservedTitleFields {
  age: AdminTitleInput["age"];
  qualityScore: number;
  provenance: Record<string, unknown>;
  workflowStatus: AdminTitleInput["workflowStatus"];
  curatorNotes: string;
  verifiedAt: string | null;
  verifiedByAccountId: string | null;
}

export const defaultPreservedTitleFields: PreservedTitleFields = {
  age: "all",
  qualityScore: 0,
  provenance: {},
  workflowStatus: "draft",
  curatorNotes: "",
  verifiedAt: null,
  verifiedByAccountId: null,
};

function normalizeAudience(value: string | null | undefined): string {
  if (value === "Young Adult") return "young-adult";
  return String(value ?? "general").toLowerCase();
}

function normalizeRisk(value: string | undefined): string {
  return value && value !== "unknown" ? value : "none";
}

/**
 * Translates today's legacy `Work`-shaped save payload into the canonical `AdminTitleInput`
 * shape and validates it — this is where real server-side validation lands for
 * `POST /api/v1/admin/titles`, which previously trusted an unvalidated hand-typed object.
 *
 * Deliberately does NOT touch `awards` — award recognitions are written exclusively through
 * `/api/v1/admin/awards/recognitions` now (Stage 2's shared, immediate-save
 * `AwardRecognitionForm`/`TitleAwardsPanel`), never as part of a title's own save payload; the
 * legacy delete-then-reinsert path this superseded has been removed entirely. It also does not
 * touch installment-level fields (`kind`/`releaseStatus`/`runtimeMinutes`) —
 * those remain the route handler's responsibility for now (see `app.ts`), since the legacy client
 * still conflates a movie title with its single installment.
 *
 * Publishing fields (`workflowStatus`/`curatorNotes`/`verifiedAt`) now have a direct editor UI
 * (Stage 2's Publishing section), so a caller sending them directly always wins; the old
 * `curation` object is only consulted as a fallback when they're absent (defensive — nothing in
 * the shipped web client sends `curation` anymore, but this keeps any other caller working).
 * `age`/`qualityScore` were never derivable from `curation` at all and simply prefer the direct
 * field, falling back to the row's current value when omitted.
 */
export function legacyTitleInputToCanonical(
  raw: LegacyTitleWritePayload,
  preserved: PreservedTitleFields,
) {
  const risk = raw.riskProfile ?? {};
  const curation = raw.curation;
  const workflowStatus =
    raw.workflowStatus !== undefined
      ? raw.workflowStatus
      : curation
        ? curation.status === "verified"
          ? "approved"
          : "in_review"
        : preserved.workflowStatus;
  const verifiedAt =
    raw.verifiedAt !== undefined
      ? raw.verifiedAt
        ? new Date(raw.verifiedAt).toISOString()
        : null
      : curation !== undefined
        ? curation && curation.status === "verified" && curation.reviewedAt
          ? new Date(`${curation.reviewedAt}T00:00:00Z`).toISOString()
          : null
        : preserved.verifiedAt;
  const curatorNotes =
    raw.curatorNotes !== undefined
      ? raw.curatorNotes
      : curation !== undefined
        ? (curation?.notes ?? "")
        : preserved.curatorNotes;
  const age = raw.age !== undefined ? raw.age : preserved.age;
  const qualityScore = raw.qualityScore !== undefined ? raw.qualityScore : preserved.qualityScore;

  return {
    id: raw.id,
    canonicalTitle: String(raw.title ?? raw.canonicalTitle ?? "").trim(),
    titleAr: raw.arabicTitle ?? null,
    summary: raw.summary ?? "",
    contentWarnings: raw.contentWarnings ?? null,
    analysisNotes: raw.analysisNotes ?? null,
    releaseYear: raw.year ?? null,
    isPrivate: raw.isPrivate ?? false,

    audience: normalizeAudience(raw.audience),
    age,
    sexualityRisk: normalizeRisk(risk.sexuality),
    behavioralRisk: normalizeRisk(risk.behavioral),
    theologyRisk: normalizeRisk(risk.theology),

    workflowStatus,
    qualityScore,
    curatorNotes,
    provenance: preserved.provenance,
    verifiedAt,

    aliases: raw.aliases ?? [],
    genres: raw.genres ?? [],
    tones: raw.tone ?? [],
    tags: raw.tags ?? [],
    countries: raw.country ?? [],
    planetId: raw.planetId ?? null,

    contributors: (raw.contributors ?? []).map((credit) => ({
      entityId: credit.entityId,
      role: credit.role,
      isPrimary: credit.isPrimary ?? false,
    })),
    relations: (raw.relations ?? []).map((relation) => ({
      titleId: relation.workId,
      relationType: relation.relationType,
      direction: relation.direction,
      notes: relation.notes ?? "",
    })),
    externalIdentities: (raw.externalLinks ?? []).map((link) => ({
      provider: link.provider,
      externalId: link.label || link.url,
      url: link.url ?? null,
    })),

    imagePath: raw.imagePath ?? null,
    bannerPath: raw.bannerPath ?? null,
    logoPath: raw.logoPath ?? null,
  };
}

export function parseLegacyTitleInput(
  raw: LegacyTitleWritePayload,
  preserved: PreservedTitleFields,
) {
  return adminTitleInputSchema.safeParse(legacyTitleInputToCanonical(raw, preserved));
}

/**
 * Writes a title's own scalar columns plus its knowledge relations (aliases, genres/tones/tags/
 * countries, planet, contributors, title relations, external identities) from a validated
 * `AdminTitleInput`. This is a full-document write: every one of those relation arrays is fully
 * replaced with what `input` contains (consistent with how the installment structure endpoint
 * already behaves) — there is no partial "only touch what's present" mode here. Partial,
 * many-titles-at-once patching is `PATCH /api/v1/admin/titles/bulk`'s job, not this function's.
 *
 * Does NOT write `awards` (see `legacyTitleInputToCanonical`'s note) or installment-level fields
 * — the caller is responsible for those until Stage 2 lands.
 *
 * `verifiedByAccountId` is never taken from `input` (the schema doesn't even carry it) — it is
 * derived here from `actorAccountId`, and only touched when `verifiedAt` actually changes from
 * its previous value, so a curator can never spoof who verified a title.
 */
export async function applyTitleWrite(
  sql: Sql,
  titleId: string | null,
  input: AdminTitleInput,
  write: {
    actorAccountId: string | null;
    previous: Pick<PreservedTitleFields, "verifiedAt" | "verifiedByAccountId">;
  },
): Promise<{ id: string }> {
  const verifiedByAccountId =
    input.verifiedAt === write.previous.verifiedAt
      ? write.previous.verifiedByAccountId
      : input.verifiedAt
        ? write.actorAccountId
        : null;

  const id = titleId
    ? await (async () => {
        const [row] = await sql`
          update titles set
            canonical_title=${input.canonicalTitle}, sort_title=${input.canonicalTitle.toLocaleLowerCase()},
            title_ar=${input.titleAr}, summary=${input.summary},
            content_warnings=${input.contentWarnings}, analysis_notes=${input.analysisNotes},
            release_year=${input.releaseYear}, is_private=${input.isPrivate},
            audience=${input.audience}, age=${input.age},
            sexuality_risk=${input.sexualityRisk}, behavioral_risk=${input.behavioralRisk},
            theology_risk=${input.theologyRisk}, workflow_status=${input.workflowStatus},
            quality_score=${input.qualityScore}, curator_notes=${input.curatorNotes},
            provenance=${JSON.stringify(input.provenance)}::jsonb, verified_at=${input.verifiedAt},
            verified_by_account_id=${verifiedByAccountId}, updated_at=now()
          where id=${titleId} returning id`;
        return row ? String(row.id) : null;
      })()
    : await (async () => {
        const [row] = await sql`
          insert into titles (canonical_title, sort_title, title_ar, summary, content_warnings,
            analysis_notes, release_year, is_private, audience, age, sexuality_risk,
            behavioral_risk, theology_risk, workflow_status, quality_score, curator_notes,
            provenance, verified_at, verified_by_account_id)
          values (${input.canonicalTitle}, ${input.canonicalTitle.toLocaleLowerCase()},
            ${input.titleAr}, ${input.summary}, ${input.contentWarnings}, ${input.analysisNotes},
            ${input.releaseYear}, ${input.isPrivate}, ${input.audience}, ${input.age},
            ${input.sexualityRisk}, ${input.behavioralRisk}, ${input.theologyRisk},
            ${input.workflowStatus}, ${input.qualityScore}, ${input.curatorNotes},
            ${JSON.stringify(input.provenance)}::jsonb, ${input.verifiedAt}, ${verifiedByAccountId})
          returning id`;
        return row ? String(row.id) : null;
      })();
  if (!id) throw new TitleWriteError(titleId ? "Title not found" : "Could not create title");

  await sql`delete from title_aliases where title_id=${id}`;
  const aliases = new Map<string, string>();
  for (const value of input.aliases) {
    const alias = value.trim();
    if (alias) aliases.set(alias.toLocaleLowerCase(), alias);
  }
  for (const alias of aliases.values())
    await sql`insert into title_aliases (title_id, title) values (${id}, ${alias}) on conflict do nothing`;

  const taxonomies = [
    ["genres", "title_genres", input.genres],
    ["tones", "title_tones", input.tones],
    ["tags", "title_tags", input.tags],
    ["countries", "title_countries", input.countries],
  ] as const;
  for (const [lookupTable, linkTable, values] of taxonomies) {
    await sql`delete from ${sql(linkTable)} where title_id=${id}`;
    for (const value of values) {
      const slug = value
        .trim()
        .toLocaleLowerCase()
        .replaceAll(/[^a-z0-9]+/g, "-");
      const [lookup] =
        await sql`select id from ${sql(lookupTable)} where slug=${slug} or lower(label_en)=lower(${value.trim()}) limit 1`;
      if (lookup)
        await sql`insert into ${sql(linkTable)} (title_id, value_id) values (${id}, ${lookup.id}) on conflict do nothing`;
    }
  }

  await sql`delete from title_planets where title_id=${id}`;
  if (input.planetId)
    await sql`insert into title_planets (title_id, planet_id) values (${id}, ${input.planetId})`;

  await sql`delete from contributions where title_id=${id}`;
  for (const [position, credit] of input.contributors.entries()) {
    const [role] = await sql`select id from roles where slug=${credit.role}`;
    if (role)
      await sql`insert into contributions (title_id, entity_id, role_id, position, is_primary) values (${id}, ${credit.entityId}, ${role.id}, ${position}, ${credit.isPrimary}) on conflict do nothing`;
  }

  await sql`delete from title_relations where source_title_id=${id} or target_title_id=${id}`;
  for (const relation of input.relations) {
    const sourceId = relation.direction === "incoming" ? relation.titleId : id;
    const targetId = relation.direction === "incoming" ? id : relation.titleId;
    await sql`insert into title_relations (source_title_id, target_title_id, kind, notes) values (${sourceId}, ${targetId}, ${relation.relationType}, ${relation.notes}) on conflict do nothing`;
  }

  await sql`delete from external_identities where title_id=${id}`;
  for (const link of input.externalIdentities)
    await sql`insert into external_identities (title_id, provider, external_id, url) values (${id}, ${link.provider}, ${link.externalId}, ${link.url}) on conflict do nothing`;

  return { id };
}

export class TitleWriteError extends Error {}
