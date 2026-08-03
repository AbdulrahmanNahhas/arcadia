# Arcadia catalog authoring guide

This guide is for creating and reviewing a catalog work. It is based on a ten-record audit of novels, anime, a movie, manga, and a series in the live database.

## Quality standard

Write for a reader deciding whether to watch or read the work. Keep factual fields sourced and concise; keep editorial fields specific, calm, and proportionate. Never present a prediction about an announced or unreleased work as observed fact.

The audit found a strong baseline: all sampled records had canonical titles, Arabic discovery titles, a normalized audience/country/genre taxonomy, and targeted content guidance. The recurring improvement opportunity is marking incomplete research clearly: use `curation.status: "provisional"`, leave `reviewedAt` absent rather than an empty string, and explain what still needs verification in `curation.notes`.

## Core work record

| Field | How to write it |
| --- | --- |
| `id` | Stable, lowercase kebab-case identifier. Never encode a temporary import source. UUIDs are acceptable for literature records already using them; do not change an existing ID casually. |
| `kind` | One of `movie`, `series`, `anime`, `manga`, `novel`, `game`, `visual-novel`, or `comic`. Choose the catalog form, not its adaptation or country. |
| `canonicalTitle` | The best-recognized official title in its original or primary international form. Preserve official punctuation and diacritics. |
| `sortTitle` | A normalized title for sorting; omit leading articles where appropriate. |
| `summary` | One compact Arabic paragraph: premise, protagonist/conflict, and distinctive setting or hook. Avoid spoilers, sales language, unsupported superlatives, and plot-by-plot recap. |
| `releaseYear` | First public release year. Pair it with exact dates in metadata when known. |
| `status` | `announced`, `releasing`, `released`, `ended`, or `unknown`. A continuing manga/anime is `releasing`; a completed TV/anime series is `ended`. |
| Metrics | Use the metric that belongs to the form: `runtimeMinutes` for a film, `episodeCount` for screen series, `chapterCount`/`volumeCount` for literature, `pageCount` for a book, and `playtimeMinutes`/`routeCount` for games. Use `null` when unknown—never invent zero. |

## Titles and credits

Create a canonical title row and, when available, a preferred Arabic localized title row. Add aliases only when they materially improve search: a common abbreviation, alternate romanization, prior regional title, or original-script title. Do not duplicate the canonical title as an alias.

Credits are normalized entities. Use the most precise role available: `author` for a book/manga creator, `main-studio` for the production studio, and publisher credits where publishing provenance matters. Keep names in their established spelling and do not put people or studios in free-form metadata.

## Taxonomy

Use normalized terms instead of metadata arrays.

| Vocabulary | Rule |
| --- | --- |
| `audience` | Choose the narrowest supported suitability band. Keep it aligned with safety notes and risk profile. |
| `country` | Country of the work’s primary production/publication origin. |
| `genre` | Broad form and narrative modes, usually two to five. |
| `tag` | Concrete discoverability traits: setting, protagonist, premise, narrative device, relationship, or subject. Prefer existing terms and avoid vague duplicates. |
| `tone` | The felt experience of the work, normally two to five terms. Do not use it to repeat genre. |

For announced works, only use tags/tone supported by official material. Mark speculative classification in curation notes and revisit after release.

## Metadata: editorial and release information

`metadata` is for structured information that does not have its own normalized table.

| Key | How to write it |
| --- | --- |
| `releaseStart` / `releaseEnd` | ISO dates (`YYYY-MM-DD`) when known. Use `null` for unknown, not an empty string. |
| `releaseWindow` | Human-readable fallback such as `Spring 2027`; do not use it when an exact date is known unless it adds useful context. |
| `sourceMaterial` | Use `type`, start/finish years, serialization, and publication for an adaptation. Use `null` for an original work. |
| `publication` | For books/manga: format, publisher, imprint, serialization, and factual contents such as chapter/epilogue counts. |
| `contentWarnings` | Arabic, specific, and neutral. Name meaningful content and its severity/context; do not turn it into a plot summary. Use `null` only after deciding that no warning is needed. |
| `analysisNotes` | Arabic critical/suitability note. State the relevant theme or worldview, distinguish depiction from endorsement, and avoid absolute claims that the work does not support. |
| `riskProfile` | `sexuality`, `behavioral`, and `theology`: `none`, `low`, `medium`, or `high`. It must agree with the warnings and analysis. |
| `watchDates` | Personal history only: ISO dates for first/last/completed consumption. Do not infer these from the work’s release date. |
| `curation` | `status`, optional `reviewedAt` (`YYYY-MM-DD`), and evidence-based notes. Use `provisional` when factual or editorial verification remains. |
| Display keys | `palette`, `bannerPosition`, `category`, `era`, and `franchise` are presentation/discovery aids. Add only when they improve the UI; they are not substitutes for taxonomy. |

## Relationships, structure, and links

Use `workRelations` for genuine links between works (adaptation, sequel, prequel, spin-off, and similar explicit relationships). Never imply a relationship merely because two works share a franchise label.

For serialized works, add seasons and units only when they support tracking or a meaningful structure. Positions start at zero and must remain stable; season/unit IDs are stable identifiers, not display text. Do not create empty placeholder seasons.

Add external links to authoritative, stable catalog pages. Prefer official pages, publisher/studio pages, AniList/MAL for anime, TMDB for film/TV, and a reputable book catalog for literature. A link label identifies the destination; it is not a citation claim.

## Review checklist

- Is the work form, release status, and date information internally consistent?
- Can a reader understand the premise from the Arabic summary without a spoiler?
- Are Arabic titles natural and searchable, while canonical/original titles remain accurate?
- Do genres, tags, and tones each add distinct discovery value?
- Do warnings, analysis, audience, and risk profile agree with one another?
- Are unknown fields `null`/absent rather than guessed or written as empty strings?
- Are provisional/research-dependent fields explicitly marked for a future review?
- Are credits, links, relations, and tracking structure normalized rather than embedded in metadata?
