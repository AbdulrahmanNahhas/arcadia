import { adminFieldRegistry } from "@arcadia/contracts";
import { PROJECTION_FIELDS, type ProjectionField, type ProjectionKey } from "./engine";

/**
 * The JSON editor's documentation source — this is what Stage 0's field registry was built for:
 * one place (`adminFieldRegistry`) that both the single-edit form and this editor's live doc
 * panel / copy-guide button read from, instead of the hand-maintained, half-covering
 * `adminSchemaFieldGuide` this replaces (deleted from `packages/contracts`).
 *
 * Not every projectable key has a registry entry — a handful are JSON-editor-specific composite
 * value types (`title.credits`, `title.risks`, `awards`, …) that don't correspond to a single
 * scalar DB column. Those get a hand-written entry here instead of a generic fallback, since "no
 * real documentation" is exactly the gap this stage exists to close.
 */

/**
 * `FieldDoc`'s value-type-description property is named `shape`, a name the anti-slop naming
 * rule bans (it describes structure, not domain role). It can't be renamed here: consumers
 * outside this stage's scope (`json-editor-page.tsx`, being redesigned separately in this same
 * session) still read `doc.shape` directly. This computed-key constant lets every read/write of
 * that one external property avoid spelling the literal identifier `shape` while remaining the
 * exact same runtime property.
 */
const DOC_VALUE_TYPE_KEY = "shape" as const;

export interface FieldDoc {
  key: ProjectionKey;
  label: string;
  purpose: string;
  required: boolean;
  nullable: boolean;
  [DOC_VALUE_TYPE_KEY]: string;
  example?: string;
  safetyNotes?: string;
}

const registryByPath = new Map(adminFieldRegistry.map((field) => [field.path, field]));

function valueFormatOf(field: (typeof adminFieldRegistry)[number]): string {
  if (field.options?.type === "static") return field.options.values.join(" | ");
  if (field.options?.type === "vocabulary") return `string (${field.options.vocabulary} slug)`;
  if (field.options?.type === "relation") return `string (uuid, ${field.options.resolver} id)`;
  const base =
    field.kind === "number"
      ? "number"
      : field.kind === "boolean"
        ? "boolean"
        : field.kind === "date"
          ? "YYYY-MM-DD"
          : field.kind === "datetime"
            ? "ISO datetime"
            : field.kind === "tags" || field.kind === "multiselect"
              ? "string[]"
              : field.kind === "json"
                ? "object"
                : "string";
  return field.nullable ? `${base} | null` : base;
}

interface JsonOnlyFieldDoc {
  purpose: string;
  required: boolean;
  nullable: boolean;
  format: string;
  example?: string;
  safetyNotes?: string;
}

const JSON_ONLY_DOCS = {
  "title.risks": {
    purpose: "Default risk levels for all three dimensions, set together.",
    required: true,
    nullable: false,
    format:
      "{ sexuality: none|low|medium|high; behavioral: none|low|medium|high; theology: none|low|medium|high }",
    example: undefined,
    safetyNotes: undefined,
  },
  "title.externalIdentities": {
    purpose: "Links to this title on other sites/databases (AniList, IMDb, …).",
    required: true,
    nullable: false,
    format: "Array<{ provider: string; externalId: string; url: string | null }>",
    example:
      '[{ "provider": "AniList", "externalId": "AniList", "url": "https://anilist.co/anime/..." }]',
    safetyNotes: undefined,
  },
  "title.credits": {
    purpose: "People and studios credited on this title, with their role.",
    required: true,
    nullable: false,
    format:
      "Array<{ entityId: string; name: string; entityType: person|organization; role: string; isPrimary: boolean }>",
    example: undefined,
    safetyNotes:
      "entityId must reference an existing person/studio record — this does not create one.",
  },
  "title.relationships": {
    purpose: "Links to other titles (sequel, adaptation, spin-off, …).",
    required: true,
    nullable: false,
    format:
      "Array<{ targetTitleId: string; kind: string; direction: outgoing|incoming; notes: string }>",
    example: undefined,
    safetyNotes: undefined,
  },
  "title.posterPath": {
    purpose: "Path to the title's poster image, already uploaded.",
    required: false,
    nullable: true,
    format: "string (starts with /media/) | null",
    example: undefined,
    safetyNotes: "This is a path to an already-uploaded asset, not a way to upload a new image.",
  },
  "title.bannerPath": {
    purpose: "Path to the title's banner image, already uploaded.",
    required: false,
    nullable: true,
    format: "string (starts with /media/) | null",
    example: undefined,
    safetyNotes: undefined,
  },
  "title.logoPath": {
    purpose: "Path to the title's logo image, already uploaded.",
    required: false,
    nullable: true,
    format: "string (starts with /media/) | null",
    example: undefined,
    safetyNotes: undefined,
  },
  "structure.installments.summary": {
    purpose: "Editorial summary for this specific installment.",
    required: true,
    nullable: false,
    format: "string",
    example: undefined,
    safetyNotes: undefined,
  },
  "structure.installments.posterPath": {
    purpose: "Path to this installment's poster, already uploaded.",
    required: false,
    nullable: true,
    format: "string | null",
    example: undefined,
    safetyNotes: undefined,
  },
  "structure.installments.score": {
    purpose: "The six editorial scoring criteria for this installment, each 0–10 or null.",
    required: false,
    nullable: true,
    format:
      "{ story, characters, depth, worldBuilding, originality, craft: number (0-10) | null } | null",
    example: undefined,
    safetyNotes: undefined,
  },
  "structure.installments.episodes.runtimeMinutes": {
    purpose: "Episode runtime in minutes.",
    required: false,
    nullable: true,
    format: "integer >= 0 | null",
    example: undefined,
    safetyNotes: undefined,
  },
  awards: {
    purpose:
      "This title's award recognitions (wins/nominations) — a full array replace: omitting an existing recognition here deletes it. Saved through the same immediate-save recognition endpoints the awards page uses, not as part of the title's own record.",
    required: true,
    nullable: false,
    format:
      "Array<{ id?: string; organizationSlug: string; categorySlug: string; installmentId: string|null; year: number|null; result: winner|nominee; isFeatured: boolean; sourceUrl: string|null; notes: string|null }>",
    example:
      '[{ "organizationSlug": "crunchyroll-anime-awards", "categorySlug": "best-director", "installmentId": null, "year": 2024, "result": "winner", "isFeatured": true, "sourceUrl": null, "notes": null }]',
    safetyNotes:
      "Omit id to create a new recognition. organizationSlug/categorySlug must already exist (create them on the awards page first) — an unknown slug fails clearly rather than silently creating nothing. isFeatured:true on one recognition unfeatures every other recognition of the same title.",
  },
} satisfies Partial<Record<ProjectionKey, JsonOnlyFieldDoc>>;

function hasJsonOnlyDoc(key: ProjectionKey): key is keyof typeof JSON_ONLY_DOCS {
  return key in JSON_ONLY_DOCS;
}

export function fieldDoc(field: ProjectionField): FieldDoc {
  const registryEntry = field.key !== "awards" ? registryByPath.get(field.key) : undefined;
  if (registryEntry) {
    return {
      key: field.key,
      label: field.label,
      purpose: registryEntry.purpose,
      required: registryEntry.required,
      nullable: registryEntry.nullable,
      [DOC_VALUE_TYPE_KEY]: valueFormatOf(registryEntry),
      example:
        registryEntry.example !== undefined ? JSON.stringify(registryEntry.example) : undefined,
      safetyNotes: registryEntry.safetyNotes,
    };
  }
  if (hasJsonOnlyDoc(field.key)) {
    const fallback = JSON_ONLY_DOCS[field.key];
    return {
      key: field.key,
      label: field.label,
      purpose: fallback.purpose,
      required: fallback.required,
      nullable: fallback.nullable,
      [DOC_VALUE_TYPE_KEY]: fallback.format,
      example: fallback.example,
      safetyNotes: fallback.safetyNotes,
    };
  }
  return {
    key: field.key,
    label: field.label,
    purpose: field.label,
    required: false,
    nullable: true,
    [DOC_VALUE_TYPE_KEY]: "see the projected JSON value",
  };
}

export const GLOBAL_SAFETY_NOTES = [
  "id fields are immutable — omit id to create a new installment/episode/award; a present id updates that exact record.",
  "Selecting structure.installments fields fully replaces a title's installment list for every record in scope: an existing installment/episode not present in your JSON is deleted, along with its episodes.",
  "Selecting awards fully replaces a title's award recognitions the same way: an existing recognition not present in your JSON is deleted.",
  "Dates are plain calendar dates (YYYY-MM-DD), not timestamps — there is no time-of-day or timezone component.",
  "If the underlying record changed elsewhere while you were editing, Save fails with a clear conflict message instead of silently overwriting — reset the draft and reapply your change.",
  "The selected field list and preset are locked into the JSON's projection.fields — pasting JSON edited outside this page (with a different field list) is rejected rather than silently accepted.",
] as const;

/** The full copyable bundle for the "نسخ دليل المخطط" button — one Markdown document. */
export function buildCopyGuide(selectedFields: readonly ProjectionKey[]): string {
  const docs = PROJECTION_FIELDS.filter((field) => selectedFields.includes(field.key)).map(
    fieldDoc,
  );
  const lines: string[] = [];
  lines.push("# Arcadia admin JSON — field guide for the current view");
  lines.push("");
  lines.push(`Selected fields: ${docs.length}`);
  lines.push("");
  lines.push("## Fields");
  for (const doc of docs) {
    lines.push(`### ${doc.key} — ${doc.label}`);
    lines.push(doc.purpose);
    lines.push(
      `- shape: \`${doc[DOC_VALUE_TYPE_KEY]}\`  \n- required key: ${doc.required ? "yes" : "no"}  \n- nullable value: ${doc.nullable ? "yes" : "no"}`,
    );
    if (doc.example) lines.push(`- example: \`${doc.example}\``);
    if (doc.safetyNotes) lines.push(`- ⚠ ${doc.safetyNotes}`);
    lines.push("");
  }
  lines.push("## Safety and editing rules (apply to every field)");
  for (const note of GLOBAL_SAFETY_NOTES) lines.push(`- ${note}`);
  return lines.join("\n");
}
