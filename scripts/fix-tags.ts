import { createHash } from "node:crypto";
import { join, resolve } from "node:path";
import Database from "better-sqlite3";

// =============================================================================
// CONFIGURATION
// =============================================================================

const MIGRATION_SOURCE = "curated-tag-cleanup-v2";

const databasePath = resolve(
  process.env.ARCADIA_DB_PATH ?? join(process.cwd(), "data", "arcadia.db"),
);

const options = {
  dryRun: process.argv.includes("--dry-run"),
  allowMissingWorks: process.argv.includes("--allow-missing-works"),
  pruneInvalidOrphans: process.argv.includes("--prune-invalid-orphans"),
  failOnWarnings: process.argv.includes("--strict"),
} as const;

// =============================================================================
// TYPES
// =============================================================================

type WorkId = string;
type CanonicalTag = string;

interface WorkTagUpdate {
  readonly tags: readonly string[];
}

interface PreparedWorkUpdate {
  readonly workId: WorkId;
  readonly tags: readonly CanonicalTag[];
}

interface ValidationIssue {
  readonly severity: "warning" | "error";
  readonly code:
    | "forbidden-genre"
    | "forbidden-tone"
    | "empty-tag"
    | "invalid-tag"
    | "duplicate-tag"
    | "deprecated-tag"
    | "suspicious-tag"
    | "missing-work"
    | "singleton-tag";
  readonly message: string;
  readonly workId?: WorkId;
  readonly tag?: string;
}

interface MigrationStats {
  readonly worksProcessed: number;
  readonly worksSkipped: number;
  readonly linksDeleted: number;
  readonly linksInserted: number;
  readonly termsCreated: number;
  readonly termsRenamed: number;
  readonly invalidOrphansDeleted: number;
}

// =============================================================================
// STRICT VOCABULARY BOUNDARIES
// =============================================================================

const GENRES = new Set(
  [
    "Action",
    "Adventure",
    "Comedy",
    "Drama",
    "Fantasy",
    "Historical",
    "Horror",
    "Mecha",
    "Military",
    "Music",
    "Mystery",
    "Political",
    "Psychological",
    "Romance",
    "Sci-Fi",
    "Slice of Life",
    "Sports",
    "Supernatural",
    "Thriller",
  ].map(normalizedComparisonKey),
);

const TONES = new Set(
  [
    "Light",
    "Wholesome",
    "Emotional",
    "Bittersweet",
    "Reflective",
    "Tense",
    "Dark",
    "Satirical",
    "Epic",
    "Atmospheric",
  ].map(normalizedComparisonKey),
);

// Common alternate spellings of genres and tones.
// These are also forbidden as tags.
const FORBIDDEN_VOCABULARY_ALIASES = new Set(
  [
    "Sci Fi",
    "Science Fiction",
    "Slice-Of-Life",
    "Slice Of Life",
    "Psychologic",
    "Supernatural Fiction",
    "Military Fiction",
    "Historical Fiction",
    "Heartwarming",
    "Cozy",
    "Melancholic",
    "Suspenseful",
    "Gritty",
    "Grim",
  ].map(normalizedComparisonKey),
);

// =============================================================================
// CANONICAL TAG NORMALIZATION
// =============================================================================

/**
 * Map variants, spelling differences, and overly narrow synonyms into one
 * reusable canonical tag.
 *
 * Keys are compared using normalizedComparisonKey(), so capitalization and
 * punctuation differences are ignored.
 */
const TAG_ALIASES = defineAliases({
  // Acronyms and formatting
  ai: "Artificial Intelligence",
  "artificial-intelligence": "Artificial Intelligence",
  ptsd: "PTSD",
  mmo: "MMO",

  // Character terminology
  "anti-hero": "Antihero",
  antihero: "Antihero",
  "non-human": "Nonhuman Characters",
  nonhuman: "Nonhuman Characters",
  "nonhuman-character": "Nonhuman Characters",
  "nonhuman-characters": "Nonhuman Characters",

  // Power systems
  "super-power": "Special Abilities",
  superpowers: "Special Abilities",
  "hidden-abilities": "Special Abilities",
  "hidden-ability": "Special Abilities",
  "special-ability": "Special Abilities",

  // Organizations and professions
  guild: "Guilds",
  ninja: "Ninjas",
  assassin: "Assassins",
  pirate: "Pirates",
  robot: "Robots",
  witch: "Witches",
  demon: "Demons",
  monster: "Monsters",
  cyborg: "Cyborgs",
  idol: "Idols",

  // Settings
  "foreign-setting": "International Setting",
  "period-setting": "Period Setting",
  "post-apocalyptic": "Post-Apocalyptic",
  postapocalyptic: "Post-Apocalyptic",

  // Themes and narrative devices
  "coming-of-age": "Coming-of-Age",
  "coming-ofage": "Coming-of-Age",
  "coming-of-age-story": "Coming-of-Age",
  "cat-mouse": "Cat and Mouse",
  "cat-and-mouse": "Cat and Mouse",
  "found-family": "Found Family",
  "time-loop": "Time Loop",
  "time-travel": "Time Travel",
  "slow-burn": "Slow Burn",
  "hidden-identity": "Hidden Identity",
  "fake-marriage": "Fake Marriage",
  "arranged-marriage": "Arranged Marriage",
  "love-triangle": "Love Triangle",
  "moral-ambiguity": "Moral Ambiguity",
  "moral-philosophy": "Moral Philosophy",
  "video-game-mechanics": "Game Mechanics",
  "game-system": "Game Mechanics",

  // Locations and environments
  ocean: "Maritime Setting",
  sailing: "Maritime Setting",
  "farm-life": "Agriculture",
  "rural-life": "Rural Setting",
  rural: "Rural Setting",

  // Technology
  cybernetics: "Cybernetics",
  cyborgs: "Cyborgs",
  robots: "Robots",
  "virtual-reality": "Virtual Reality",

  // Disability-related tags
  blindness: "Visual Impairment",
  "deaf-protagonist": "Deaf Characters",
  deafness: "Deaf Characters",

  // Crime terminology
  gangs: "Criminal Organizations",
  "crime-organization": "Criminal Organizations",
  "crime-organizations": "Criminal Organizations",

  // Conflict
  "class-conflict": "Class Conflict",
  "wealth-gap": "Class Conflict",

  // Other cleanup
  guilds: "Guilds",
  "adult-cast": "Adult Cast",
  "teen-cast": "Teen Cast",
  "child-cast": "Child Cast",
  "ensemble-cast": "Ensemble Cast",
  "male-protagonist": "Male Protagonist",
  "female-protagonist": "Female Protagonist",
});

/**
 * Old tags that should never be created again.
 *
 * Some are franchise-specific terms; others should map to broader canonical
 * concepts through TAG_ALIASES.
 */
const DEPRECATED_TAGS = new Set(
  [
    "Automemories Doll",
    "Breathing Techniques",
    "Cursed Energy",
    "Devil Fruit",
    "Domain Expansion",
    "Grand Line",
    "Hero Association",
    "Hero Society",
    "Nen",
    "Numberless Witch",
    "Quirks",
    "Return By Death",
    "Section 9",
    "Seven Mysteries",
    "Shinigami",
    "Villain League",
    "Yakuza War",
  ].map(normalizedComparisonKey),
);

/**
 * These patterns usually indicate that a tag is too title-specific to work
 * well across a mixed-media library.
 *
 * The migration reports them as errors so they can be replaced intentionally.
 */
const SUSPICIOUS_TAG_PATTERNS: readonly RegExp[] = [
  /\bchapter\s+\d+\b/i,
  /\bepisode\s+\d+\b/i,
  /\bseason\s+\d+\b/i,
  /\bvolume\s+\d+\b/i,
  /\barc\b/i,
  /\broute\b/i,
  /\bending\b/i,
  /\bcharacter named\b/i,
];

// =============================================================================
// DATA
// =============================================================================

/**
 * Rename your current `updates` object to `rawUpdates`.
 *
 * The object below only demonstrates the typing. Paste your complete existing
 * object here.
 */
const rawUpdates = {
  "obsidian-animation-tv-86-eighty-six": {
    tags: [
      "Trauma",
      "Racism",
      "Teen Cast",
      "Survival",
      "Philosophy",
      "Class Conflict",
      "Nonlinear Story",
      "Female Protagonist",
      "Male Protagonist",
      "Found Family",
      "Ensemble Cast",
      "Dystopian",
      "War",

      // Removed: Mecha and Military, because both are genres.
    ],
  },

  "obsidian-animation-tv-attack-on-titan": {
    tags: [
      "Trauma",
      "Survival",
      "Cannibalism",
      "Special Abilities",
      "Revenge",
      "Post-Apocalyptic",
      "Conspiracy",
      "Betrayal",
      "Ensemble Cast",
      "Kaiju",
      "Dystopian",
      "Moral Ambiguity",
      "War",

      // Removed: Military, because it is a genre.
    ],
  },

  "obsidian-animation-tv-blue-box": {
    tags: [
      "School Club",
      "Teen Cast",
      "Cohabitation",
      "School",
      "Female Protagonist",
      "Male Protagonist",
      "Coming-of-Age",
      "Love Triangle",
      "Slow Burn",

      // Removed: Sports, because it is a genre.
    ],
  },

  "obsidian-animation-tv-bocchi-the-rock": {
    tags: [
      "Introvert",
      "Cute Girls Doing Cute Things",
      "School",
      "Female Protagonist",
      "Social Anxiety",
      "Band",
      "Coming-of-Age",

      // Removed: Music, because it is a genre.
    ],
  },

  "obsidian-animation-tv-death-note": {
    tags: [
      "Special Abilities",
      "Gods",
      "Teen Cast",
      "Mind Games",
      "Antihero",
      "Detective",
      "God Complex",
      "Male Protagonist",
      "Police",
      "Crime",
      "Cat and Mouse",
      "Vigilante Justice",
      "Moral Ambiguity",

      // Removed: Psychological, because it is a genre.
    ],
  },

  "obsidian-animation-tv-pluto": {
    tags: [
      "Philosophy",
      "Artificial Intelligence",
      "Robots",
      "Urban",
      "Cyberpunk",
      "Detective",
      "Male Protagonist",
      "Murder Mystery",
      "Police",
      "Guns",
      "Crime",
      "Adult Cast",
      "Travel",
      "Ensemble Cast",
    ],
  },

  "obsidian-animation-tv-steinsgate": {
    tags: [
      "Otaku Culture",
      "Mad Scientist",
      "Mind Games",
      "Male Protagonist",
      "Time Travel",
      "Urban",
      "Conspiracy",
      "Tragedy",

      // Removed: Sci-Fi, because it is a genre.
    ],
  },

  "obsidian-animation-tv-violet-evergarden": {
    tags: [
      "Writing",
      "Grief",
      "PTSD",
      "Female Protagonist",
      "Period Setting",
      "Healing",
      "Workplace",
      "Travel",
      "Cyborgs",
    ],
  },
} as const satisfies Record<WorkId, WorkTagUpdate>;

// =============================================================================
// GENERAL UTILITIES
// =============================================================================

function stableId(...parts: readonly string[]): string {
  return createHash("sha256").update(parts.join(":"), "utf8").digest("hex").slice(0, 32);
}

function slug(value: string): string {
  return value
    .toLocaleLowerCase("en-US")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizedComparisonKey(value: string): string {
  return slug(value);
}

function cleanWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function defineAliases(
  aliases: Readonly<Record<string, CanonicalTag>>,
): ReadonlyMap<string, CanonicalTag> {
  return new Map(
    Object.entries(aliases).map(([alias, canonical]) => [
      normalizedComparisonKey(alias),
      cleanWhitespace(canonical),
    ]),
  );
}

function canonicalizeTag(rawTag: string): CanonicalTag {
  const cleaned = cleanWhitespace(rawTag);
  const key = normalizedComparisonKey(cleaned);

  return TAG_ALIASES.get(key) ?? cleaned;
}

function isGenre(value: string): boolean {
  return GENRES.has(normalizedComparisonKey(value));
}

function isTone(value: string): boolean {
  return TONES.has(normalizedComparisonKey(value));
}

function isForbiddenVocabularyAlias(value: string): boolean {
  return FORBIDDEN_VOCABULARY_ALIASES.has(normalizedComparisonKey(value));
}

function isDeprecatedTag(value: string): boolean {
  return DEPRECATED_TAGS.has(normalizedComparisonKey(value));
}

function hasSuspiciousPattern(value: string): boolean {
  return SUSPICIOUS_TAG_PATTERNS.some((pattern) => pattern.test(value));
}

// =============================================================================
// VALIDATION AND PREPARATION
// =============================================================================

function validateAndPrepareUpdates(input: Readonly<Record<WorkId, WorkTagUpdate>>): {
  readonly updates: readonly PreparedWorkUpdate[];
  readonly issues: readonly ValidationIssue[];
  readonly frequencies: ReadonlyMap<CanonicalTag, number>;
} {
  const issues: ValidationIssue[] = [];
  const preparedUpdates: PreparedWorkUpdate[] = [];
  const frequencies = new Map<CanonicalTag, number>();

  for (const [workId, data] of Object.entries(input)) {
    const canonicalTags: CanonicalTag[] = [];
    const seenSlugs = new Set<string>();

    for (const rawTag of data.tags) {
      const cleaned = cleanWhitespace(rawTag);

      if (!cleaned) {
        issues.push({
          severity: "error",
          code: "empty-tag",
          workId,
          message: `Work "${workId}" contains an empty tag.`,
        });
        continue;
      }

      const canonical = canonicalizeTag(cleaned);
      const canonicalSlug = slug(canonical);

      if (!canonicalSlug) {
        issues.push({
          severity: "error",
          code: "invalid-tag",
          workId,
          tag: rawTag,
          message: `Tag "${rawTag}" does not produce a valid slug.`,
        });
        continue;
      }

      if (
        isGenre(canonical) ||
        isGenre(rawTag) ||
        isForbiddenVocabularyAlias(canonical) ||
        isForbiddenVocabularyAlias(rawTag)
      ) {
        issues.push({
          severity: "error",
          code: "forbidden-genre",
          workId,
          tag: rawTag,
          message: `"${rawTag}" is a genre and must not be stored as a tag.`,
        });
        continue;
      }

      if (isTone(canonical) || isTone(rawTag)) {
        issues.push({
          severity: "error",
          code: "forbidden-tone",
          workId,
          tag: rawTag,
          message: `"${rawTag}" is a tone and must not be stored as a tag.`,
        });
        continue;
      }

      if (isDeprecatedTag(rawTag) && canonical === cleaned) {
        issues.push({
          severity: "error",
          code: "deprecated-tag",
          workId,
          tag: rawTag,
          message:
            `"${rawTag}" is deprecated or too title-specific and has no ` +
            "canonical replacement.",
        });
        continue;
      }

      if (hasSuspiciousPattern(canonical)) {
        issues.push({
          severity: "error",
          code: "suspicious-tag",
          workId,
          tag: canonical,
          message:
            `"${canonical}" appears too title-specific or structurally ` +
            "unsuitable for a reusable library taxonomy.",
        });
        continue;
      }

      if (seenSlugs.has(canonicalSlug)) {
        issues.push({
          severity: "warning",
          code: "duplicate-tag",
          workId,
          tag: canonical,
          message: `Duplicate tag "${canonical}" was removed from work "${workId}".`,
        });
        continue;
      }

      seenSlugs.add(canonicalSlug);
      canonicalTags.push(canonical);
    }

    canonicalTags.sort((left, right) => left.localeCompare(right, "en", { sensitivity: "base" }));

    for (const tag of canonicalTags) {
      frequencies.set(tag, (frequencies.get(tag) ?? 0) + 1);
    }

    preparedUpdates.push({
      workId,
      tags: canonicalTags,
    });
  }

  for (const [tag, count] of frequencies) {
    if (count === 1) {
      issues.push({
        severity: "warning",
        code: "singleton-tag",
        tag,
        message:
          `"${tag}" currently appears on one updated work. It is allowed ` +
          "because it is reusable, but should be reviewed.",
      });
    }
  }

  return {
    updates: preparedUpdates,
    issues,
    frequencies,
  };
}

function printIssues(issues: readonly ValidationIssue[]): void {
  const errors = issues.filter((issue) => issue.severity === "error");
  const warnings = issues.filter((issue) => issue.severity === "warning");

  if (errors.length > 0) {
    console.error(`\n❌ Validation errors: ${errors.length}`);

    for (const issue of errors) {
      console.error(`   [${issue.code}] ${issue.message}`);
    }
  }

  if (warnings.length > 0) {
    console.warn(`\n⚠️ Validation warnings: ${warnings.length}`);

    for (const issue of warnings) {
      console.warn(`   [${issue.code}] ${issue.message}`);
    }
  }
}

function printFrequencyReport(frequencies: ReadonlyMap<CanonicalTag, number>): void {
  const entries = [...frequencies.entries()].sort(
    ([leftTag, leftCount], [rightTag, rightCount]) =>
      rightCount - leftCount || leftTag.localeCompare(rightTag, "en", { sensitivity: "base" }),
  );

  console.log("\n📊 Tag frequency within this migration:");

  for (const [tag, count] of entries) {
    const marker = count === 1 ? "review" : "shared";
    console.log(`   ${String(count).padStart(2)}  ${tag} (${marker})`);
  }
}

// =============================================================================
// DATABASE SETUP
// =============================================================================

const db = new Database(databasePath);

db.pragma("foreign_keys = ON");
db.pragma("journal_mode = WAL");
db.pragma("busy_timeout = 5000");

console.log(`📁 Connected to DB: ${databasePath}`);
console.log(`🧪 Dry run: ${options.dryRun ? "yes" : "no"}`);

// =============================================================================
// PREPARE AND VALIDATE
// =============================================================================

const prepared = validateAndPrepareUpdates(rawUpdates);

printIssues(prepared.issues);
printFrequencyReport(prepared.frequencies);

const validationErrors = prepared.issues.filter((issue) => issue.severity === "error");

const validationWarnings = prepared.issues.filter((issue) => issue.severity === "warning");

if (validationErrors.length > 0) {
  db.close();
  throw new Error(
    `Migration aborted because ${validationErrors.length} validation error(s) were found.`,
  );
}

if (options.failOnWarnings && validationWarnings.length > 0) {
  db.close();
  throw new Error(
    `Migration aborted because --strict was used and ` +
      `${validationWarnings.length} warning(s) were found.`,
  );
}

// =============================================================================
// DATABASE STATEMENTS
// =============================================================================

const workExistsStmt = db.prepare<[string], { readonly exists: 1 }>(`
  SELECT 1 AS "exists"
  FROM works
  WHERE id = ?
  LIMIT 1
`);

const findTermStmt = db.prepare<
  [string, string],
  {
    readonly id: string;
    readonly name: string;
    readonly slug: string;
  }
>(`
  SELECT id, name, slug
  FROM terms
  WHERE vocabulary = ?
    AND slug = ?
  LIMIT 1
`);

const insertTermStmt = db.prepare<[string, string, string, string]>(`
  INSERT INTO terms (
    id,
    vocabulary,
    name,
    slug
  )
  VALUES (?, ?, ?, ?)
`);

const renameTermStmt = db.prepare<[string, string]>(`
  UPDATE terms
  SET name = ?
  WHERE id = ?
`);

const deleteWorkTagsStmt = db.prepare<[string]>(`
  DELETE FROM work_terms
  WHERE work_id = ?
    AND term_id IN (
      SELECT id
      FROM terms
      WHERE vocabulary = 'tag'
    )
`);

const insertWorkTermStmt = db.prepare<[string, string, string]>(`
  INSERT INTO work_terms (
    work_id,
    term_id,
    source
  )
  VALUES (?, ?, ?)
  ON CONFLICT (work_id, term_id)
  DO UPDATE SET source = excluded.source
`);

const invalidOrphanCandidatesStmt = db.prepare<
  [],
  {
    readonly id: string;
    readonly name: string;
    readonly slug: string;
  }
>(`
  SELECT
    terms.id,
    terms.name,
    terms.slug
  FROM terms
  WHERE terms.vocabulary = 'tag'
    AND NOT EXISTS (
      SELECT 1
      FROM work_terms
      WHERE work_terms.term_id = terms.id
    )
  ORDER BY terms.name COLLATE NOCASE
`);

const deleteOrphanTermStmt = db.prepare<[string]>(`
  DELETE FROM terms
  WHERE id = ?
    AND vocabulary = 'tag'
    AND NOT EXISTS (
      SELECT 1
      FROM work_terms
      WHERE work_terms.term_id = terms.id
    )
`);

// =============================================================================
// DATABASE HELPERS
// =============================================================================

function getOrCreateTag(name: CanonicalTag): {
  readonly id: string;
  readonly created: boolean;
  readonly renamed: boolean;
} {
  const vocabulary = "tag";
  const termSlug = slug(name);

  const existing = findTermStmt.get(vocabulary, termSlug);

  if (existing) {
    const shouldRename = existing.name !== name;

    if (shouldRename) {
      renameTermStmt.run(name, existing.id);
    }

    return {
      id: existing.id,
      created: false,
      renamed: shouldRename,
    };
  }

  const id = stableId("term", vocabulary, termSlug);

  insertTermStmt.run(id, vocabulary, name, termSlug);

  return {
    id,
    created: true,
    renamed: false,
  };
}

function shouldPruneInvalidOrphan(name: string): boolean {
  return (
    isGenre(name) ||
    isTone(name) ||
    isForbiddenVocabularyAlias(name) ||
    isDeprecatedTag(name) ||
    hasSuspiciousPattern(name)
  );
}

// =============================================================================
// MIGRATION
// =============================================================================

const applyUpdates = db.transaction(
  (workUpdates: readonly PreparedWorkUpdate[]): MigrationStats => {
    let worksProcessed = 0;
    let worksSkipped = 0;
    let linksDeleted = 0;
    let linksInserted = 0;
    let termsCreated = 0;
    let termsRenamed = 0;
    let invalidOrphansDeleted = 0;

    for (const update of workUpdates) {
      const workExists = workExistsStmt.get(update.workId);

      if (!workExists) {
        if (options.allowMissingWorks) {
          console.warn(`⚠️ Skipping missing work: ${update.workId}`);
          worksSkipped++;
          continue;
        }

        throw new Error(`Work does not exist: ${update.workId}`);
      }

      const deleteResult = deleteWorkTagsStmt.run(update.workId);
      linksDeleted += deleteResult.changes;

      for (const tag of update.tags) {
        const term = getOrCreateTag(tag);

        if (term.created) {
          termsCreated++;
        }

        if (term.renamed) {
          termsRenamed++;
        }

        const linkResult = insertWorkTermStmt.run(update.workId, term.id, MIGRATION_SOURCE);

        linksInserted += linkResult.changes;
      }

      worksProcessed++;
    }

    /**
     * Do not delete ordinary orphan tags.
     *
     * A valid orphan such as "Robot Rights", "Letter Writing", or
     * "Butterfly Effect" may be useful for a later novel, film, game, manga,
     * or anime.
     *
     * Only invalid orphans are optionally removed.
     */
    if (options.pruneInvalidOrphans) {
      const orphanCandidates = invalidOrphanCandidatesStmt.all();

      for (const orphan of orphanCandidates) {
        if (!shouldPruneInvalidOrphan(orphan.name)) {
          continue;
        }

        invalidOrphansDeleted += deleteOrphanTermStmt.run(orphan.id).changes;
      }
    }

    return {
      worksProcessed,
      worksSkipped,
      linksDeleted,
      linksInserted,
      termsCreated,
      termsRenamed,
      invalidOrphansDeleted,
    };
  },
);

// =============================================================================
// EXECUTION
// =============================================================================

try {
  if (options.dryRun) {
    db.exec("BEGIN IMMEDIATE");

    try {
      const stats = applyUpdates(prepared.updates);

      console.log("\n🧪 Dry-run result:");
      printStats(stats);
    } finally {
      db.exec("ROLLBACK");
      console.log("↩️ All dry-run database changes were rolled back.");
    }
  } else {
    const stats = applyUpdates(prepared.updates);

    console.log("\n✅ Tag migration complete.");
    printStats(stats);
  }

  printRemainingOrphans();
} catch (error) {
  console.error("\n❌ Failed to apply tag migration.");

  if (error instanceof Error) {
    console.error(error.message);
  } else {
    console.error(error);
  }

  process.exitCode = 1;
} finally {
  db.close();
}

function printStats(stats: MigrationStats): void {
  console.log(`   Works processed:        ${stats.worksProcessed}`);
  console.log(`   Works skipped:          ${stats.worksSkipped}`);
  console.log(`   Old tag links removed:  ${stats.linksDeleted}`);
  console.log(`   Tag links established:  ${stats.linksInserted}`);
  console.log(`   New terms created:      ${stats.termsCreated}`);
  console.log(`   Existing terms renamed: ${stats.termsRenamed}`);
  console.log(`   Invalid orphans pruned: ${stats.invalidOrphansDeleted}`);
}

function printRemainingOrphans(): void {
  const orphans = invalidOrphanCandidatesStmt.all();

  if (orphans.length === 0) {
    console.log("\n🧹 No unused tag terms remain.");
    return;
  }

  const invalid = orphans.filter((term) => shouldPruneInvalidOrphan(term.name));

  const valid = orphans.filter((term) => !shouldPruneInvalidOrphan(term.name));

  console.log(`\n📦 Unused but reusable tags retained: ${valid.length}`);

  for (const term of valid) {
    console.log(`   - ${term.name}`);
  }

  if (invalid.length > 0) {
    console.warn(`\n⚠️ Invalid unused tags detected: ${invalid.length}`);

    for (const term of invalid) {
      console.warn(`   - ${term.name}`);
    }

    console.warn("Run with --prune-invalid-orphans to remove only these invalid terms.");
  }
}
