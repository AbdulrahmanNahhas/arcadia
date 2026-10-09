# Linux client design checkpoints

Updated 2026-10-09. This is Aqua's current UI request, alongside
[the Linux client plan](./linux-client-plan.md). Complete one checkpoint, show the result and
actual verification, then stop for Aqua's design and behavior review. Do not implement the
whole checklist without those reviews. Keep commits focused and the working app runnable.

## Confirmed direction

- Rust GTK4/libadwaita + WebKitGTK shell, separate React/Vite/TypeScript viewing UI.
- Arabic-first, responsive, artwork-led design using Aqua's four supplied screenshots.
- Home order: hero → latest updates → one planet section with a dropdown → latest family
  comments/reviews → anticipated installments.
- Latest comments means family members' comments/reviews only, not editorial notes.
- Anticipated means upcoming installments, including a single new season of an existing work,
  sorted by nearest announced release date. Unknown dates remain explicitly unknown.
- Public catalog by default on home and browse. Browse has an explicit private-work opt-in.
- A work gets a full page in the app, not just a small side preview. All viewing-relevant
  catalog data and relations must be reachable; administration stays in the dashboard.
- Playback, downloads and saved packs remain separate workflows; pending actions stay disabled.

## Review checklist

### H01 — Hero, reference image 2

- [x] Large banner with prominent stored logo or readable title fallback, RTL composition,
      concise summary, and compact real metadata.
- [x] Working details action; honest disabled playback action until playback exists.
- [x] Up to ten latest added public works; previous/next and direct slide selection.
- [x] Pause rotation on focus/hover, an explicit pause control, and respect reduced motion.
- [x] Good loading/empty/image-fallback behavior; no horizontal overflow at narrow sizes.
- [x] Browser behavior/responsive checks and actual packaged GTK/WebKit rendering.
- [x] Aqua approved the hero.

### H01a — Compact topbar and shared controls

- [x] Fix the conflicting fixed height/padding and keep search/account controls usable.
- [x] Home topbar overlays the hero with background-to-transparent fade; browse retains a solid bar.
- [x] Tailwind 4 + official shadcn controls, mapped to the client palette and RTL.
- [x] Replace current dropdowns; preserve keyboard behavior, focus, and packaged CSP.
- [x] Verify browser sizes and actual GTK rendering; stop for review without committing.

### H02 — Shared work and installment cards, reference image 1

- [ ] Improve image/title/metadata hierarchy, hover and visible focus without clipped edges.
- [ ] One shared card supports works and individual installments with distinct identifiers
      and correct destination/context.
- [ ] Show the dashboard's calculated score, not external ratings or `qualityScore`.
      Source of truth: `packages/domain/src/scoring.ts` and
      `apps/web/src/features/scoring/score.server.ts`.
- [ ] Use six complete criteria with existing weights: story 25%, characters 20%, depth 20%,
      world building 10%, originality 10%, craft 15%. Installment rating uses its own criteria;
      work rating averages complete installment values before rounding to one decimal.
- [ ] Incomplete scores stay unrated; show coverage where helpful. Do not treat null as zero.
- [ ] Installment cards show episode count or movie runtime, release/status and own score.
- [ ] Add bounded API fields/contract coverage, verify dashboard parity and review examples.

### H03 — Latest updates and planet selector, reference image 1

- [ ] Keep latest updates directly after the hero.
- [ ] Replace the long list of individual planet shelves with one selected-planet shelf.
- [ ] Heading dropdown contains real planet names and stored icons, selected state and counts.
- [ ] Selecting a planet changes the bounded server query; “view all” carries its filter.
- [ ] Keep the rail's planet entry; no private works appear in public shelves or their counts.
- [ ] Review dropdown keyboard behavior, shelf sizing and loading/empty/error states.

### H04 — Latest family comments/reviews, reference image 3

- [ ] Use existing `title_comments` and `title_reviews`; inspect account/visibility rules
      before exposing their contents. Do not create another comments schema.
- [ ] Read-only bounded feed: work poster/title, author/avatar, time and comment/review body.
- [ ] Published entries only; exclude private works and unavailable accounts as policy requires.
- [ ] Respect spoilers with an explicit reveal; never render arbitrary comment HTML.
- [ ] Link each entry to its work and relevant comments area.
- [ ] Real empty state when no eligible comments exist; no fabricated activity.

### H05 — Most anticipated installments

- [ ] Query installment release dates/statuses, not only title release years.
- [ ] Include new seasons, movies and other upcoming installments of existing works.
- [ ] Nearest known release first, stable ordering, public works only and bounded results.
- [ ] Show parent work, installment name/kind and honest release-date precision/status.
- [ ] Agree handling of announced entries with no date; no invented countdown/popularity.
- [ ] Use H02 installment cards; opening a card selects that installment on its work page.

### B01 — Browse and complete filters

- [ ] Inspect `master:apps/web/src/features/catalog/catalog-filters.tsx` and
      `catalog-filtering.ts` as the existing filter-sheet behavior reference.
- [ ] Build a field-to-filter inventory from the actual schema and old sheet before claiming
      “everything.” Include multi-select include/exclude semantics and null/unknown handling.
- [ ] Cover formats/kinds, planets, genres/tones/tags/countries, audience/age, risks/warnings,
      release/status/date ranges, scores/individual criteria, people/studios/awards, editorial
      verification, watched/progress and source/offline availability where their services exist.
- [ ] Clearly disable controls whose backend data/behavior is not implemented.
- [ ] Toggle works versus installments; preserve meaningful filters and show correct counts.
- [ ] Searchable grouped filter sheet with selected chips/count, reset and accessible labels.
- [ ] Server pagination/filtering/sorting; no whole-catalog fetch or silent UI-only filtering.
- [ ] Test combined filters, private opt-in, empty results, ordering and cancellation.

### W01 — Full work page, reference image 4

- [ ] Banner/logo/poster header with real metadata, clear back navigation and return-to-grid
      focus/scroll restoration. It fills the content area without forcing OS fullscreen.
- [ ] Inventory every viewing-relevant catalog field/relation and mark its destination so
      nothing silently disappears behind the word “all.”
- [ ] Overview: names/aliases, summary, dates, format/kind, genres/tones/tags/countries/planets.
- [ ] Family: age/audience, all risk levels, warnings, analysis and curator notes.
- [ ] Installments/episodes: selection, status/dates, runtime/counts, episode metadata and
      future play/source/download actions with honest availability.
- [ ] Scores: per-installment six criteria, aggregate rating and coverage, consistent with H02.
- [ ] People/studios/contributions, awards, related works, trivia, artwork and external IDs/links.
- [ ] Family comments/reviews, watched state/progress and saved/download context when implemented.
- [ ] Preserve ownership/authorization; account secrets and admin internals are not work metadata.
- [ ] Use tabs/sections for readability, progressive bounded loads for large relations and
      full text expansion. Do not cut contributions/episodes/data to an arbitrary first few entries.

### Q01 — Actual scrolling and keyboard behavior

- [ ] Reproduce remaining lag in GTK/WebKit, compare with browser, measure image decode/layout/
      paint/request behavior before choosing a fix. Browser tests alone do not prove native smoothness.
- [ ] Retain native wheel/trackpad scrolling; avoid repeated blur/filter/large paint work.
- [ ] Define predictable arrow movement across hero, shelves, dropdowns, browse, rail and tabs.
- [ ] Respect RTL physical directions, avoid unwanted jumps, restore focus on close/back and
      avoid hijacking text-input/select keys. Verify held keys and reduced motion.
- [ ] Keep the native title bar hidden only in fullscreen and verify F11 behavior on Shadow.

## Checkpoint status

- Previous small polish pass preserved in commit `952ad3c` before this design pass.
- H01 is approved. H01a is the current checkpoint; remaining home tasks follow review.
- Existing minimal login/library works; this checklist does not claim player, comprehensive
  filters, comments feed or full work pages are already implemented.

## H01 verification — 2026-10-09

- `pnpm check` and `pnpm build` passed across the workspace.
- All seven client browser journeys passed, including the hero metadata, manual selection,
  pause control and details action; existing responsive journeys cover 480/640/1024/1440 widths.
- Actual packaged GTK/WebKit smoke passed login, catalog/artwork rendering and logout with no
  UI alerts. The native hero snapshot was inspected in ignored `data/previews/hero-review/`.
- Host font/accessibility/graphics warnings remain; smoothness is not proven by this smoke run.
- H01 adds no schema changes or catalog writes. Login/logout creates/revokes an ordinary session.
- Score badges await H02; details currently open the existing preview until W01 is implemented.

## H01a verification and review boundary

The topbar/control checkpoint is implemented and awaiting review. Tailwind 4 and official
shadcn Select/Button/InputGroup (with their Input/Textarea dependencies) use the existing client
palette. All five existing dropdowns now use Select; media cards retain their own composition.
The native capture waits for hero images before saving the home screen. The packaged policy
was not relaxed. No catalog/schema changes were introduced.

Aqua explicitly requires commit confirmation from this point onward. Leave this checkpoint
uncommitted until requested. The next home tasks remain scored cards, a selected-planet section,
latest family comments/reviews and anticipated installments, with review after each task.
