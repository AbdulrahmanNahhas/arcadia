# Tracking Overhaul, Watch Gating, My Space Redesign & i18n Fixes

> **Status:** Phases A and B done in code (2026-08-27); **neither phase's migration is applied yet
> — run `devenv shell -- pnpm db:migrate` against your dev DB before relying on either (0018 for
> Phase A, 0019 for Phase B).** · Last revised 2026-08-27
> **Updating this doc:** tick checkboxes as tasks land; set each phase's status line to
> `Done (YYYY-MM-DD)` when its goal is met.

Follow-on work after the torrent player (`docs/player-torrent-roadmap.md`) Phase 1 landed: the
catalog now needs to drop its pre-torrent "status" tracking (planned/watching/paused/dropped/
completed) in favor of Jellyfin-style progress-based watched tracking, the watch button needs to
stop offering playback that can't work, the personal dashboard ("My Space", today `/archive`)
gets a real redesign, and two unrelated Arabic-rendering bugs need fixing.

## Decisions locked in
- Full removal of `library_status` (`planned/watching/paused/dropped/completed`) — schema, API,
  contracts, Library tabs/filters/sorting, archive dashboard badges. `isFavorite`/
  `personalRating`/`notes`/`title_reviews` are untouched — separate concern.
- Jellyfin-style tracking: auto-mark watched at a threshold, manual override toggle, at
  movie/episode granularity with season/series rollups computed on read, not stored redundantly.
- My Space (`/archive`) redesign ships in this same plan, as its own phase (Phase D), not deferred
  to after tracking lands, even though its best content depends on Phase B's data.
- Drop the Collections tab from the dashboard; add an "all works I've scored" view; the family
  panel becomes an AniList-style feed (comments/ratings/reactions), built reusable as a sidebar.
- New dashboard widget: active torrents/downloads, sourced from the Rust torrent session.
- The taxonomy-label bug reproduces on the title page and others — needs a live repro (exact
  genre/tag/tone + what renders instead of the Arabic label) before a fix lands; the app has no
  English/Arabic UI toggle, so this is not a locale-switch regression.
- Separate, unrelated bug: Arabic tashkeel (ّ ِ ً ٍ) renders shifted/broken only in the Tauri
  build, not the browser — introduced by the Tauri migration, looks like a WebKitGTK text-shaping
  issue.

---

## Phase A — Delete the legacy status/workflow tracking

**Goal:** no trace of `planned/watching/paused/dropped/completed` left; nothing reads or writes
`library_status` anywhere.

- [x] `packages/database/src/schema.ts`: dropped `libraryStatusEnum` and
      `accountTitleStates.status`/`startedAt`/`completedAt` (the latter two were solely
      status-derived and had no other writer). Migration generated:
      `drizzle/0018_yellow_dorian_gray.sql` (`DROP COLUMN status/started_at/completed_at`,
      `DROP TYPE library_status`). **Not yet applied to any live DB — run
      `devenv shell -- pnpm db:migrate` yourself.**
- [x] `packages/contracts/src/index.ts`: removed `libraryStatusSchema` and `status` from
      `accountTitleStateSchema`/`upsertTitleStateInputSchema`; dropped the `"status"` member from
      `familyActivitySchema`'s `kind` enum (the family-activity feed no longer synthesizes a
      status-change event, only `favorite`/`review`/`comment`).
- [x] API: `apps/api/src/features/social/routes.ts` — removed the `status`/`startedAt`/
      `completedAt` handling from the library GET/PUT/social-state queries, and the
      `family/activity` union's status branch.
- [x] Web:
  - [x] `apps/web/src/features/archive/api.ts` (`LibraryItem.status` type removed)
  - [x] `apps/web/src/features/archive/archive-panels.tsx` — Library panel's status
        select/filter/saved-view UI removed (favorites + personal rating only now); the
        "قيد المشاهدة" quick-stat replaced with a "مقيَّمة شخصيًا" (personally-rated) count
  - [x] `apps/web/src/features/social/api.ts` (`updateTitleState`'s `status` param removed)
  - [x] `apps/web/src/server/platform.functions.ts` — `continueExploring` now returns `[]` with a
        `TODO(tracking)` pointing at Phase B (no status-based data left to drive it), and
        `selectHeroWorks`'s personal-boost scoring drops the status-based terms
  - [x] `packages/cli/src/registry.ts` — the `library` resource's `listColumns` no longer names
        the dropped `status` column (also fixed a pre-existing stale `rating` → `personal_rating`)
- [ ] **Deliberately deferred to Phase F, not touched here:** `apps/web/src/features/library/model.ts`
      (`personalStatusSchema`, `Work.status`, `progress`, `watchDates`, `trackedOn`, `completedAt`),
      `filtering.ts` (`personalStatuses`, status-based sort/filter), `translations.ts`
      (`statusLabelsAr`), `work-artwork.tsx`. Investigation found these belong to a **different,
      already-dead** status cluster on the shared `Work` compat model — `apps/web/src/server/compat.ts`
      hardcodes `status: "saved"`, `progress: 0`, `watchDates: null`, etc. for every work, always,
      so this path already carries no real per-account state today. It doesn't reference
      `libraryStatusEnum`/`accountTitleStateSchema` at all, so nothing above depended on touching
      it, but the naming collision with the real status this phase removed is exactly the kind of
      confusion worth cleaning up — just as a separate, self-contained sweep (it's imported by
      ~30 files for the unrelated rest of the `Work` type, so it needs its own careful pass).
- [x] Grep sweep confirms no remaining `status ===`/`"watching"`/`"dropped"`/`libraryStatus`
      references outside that deferred cluster.
- [x] Verified: `pnpm check` (oxlint + biome + typecheck) clean on every touched file, full
      `pnpm test` (189 tests across all 7 workspaces) green with Postgres up, `pnpm build` clean.

## Phase B — Jellyfin-style progress tracking (replaces it)

**Status:** Done (2026-08-27).

**Goal:** an episode/movie is "watched" once played past a threshold, with a manual override, and
this is what "continue watching" / "up next" / series-progress badges are driven by.

- [x] Schema — extend `account_playback_states` rather than reintroduce a status enum:
  - [x] `durationSeconds integer` (needed to compute a percentage; currently only
        `positionSeconds` exists) — nullable: a torrent-backed stream, and every pre-Phase-B row,
        may not have one.
  - [x] `isPlayed boolean not null default false` — **renamed** from `completed` via a real SQL
        `RENAME COLUMN` (not drop+add), so existing values carry forward as the starting
        auto-computed state rather than being discarded.
  - [x] `playedManually boolean not null default false` — so an auto-set flag never gets silently
        clobbered by a later auto-recompute once the user has explicitly toggled it.
  - [x] `playedAt timestamp` (nullable).
  - [x] Migration: `packages/database/drizzle/0019_tough_zarek.sql`. **Not yet applied — run
        `devenv shell -- pnpm db:migrate` yourself**, same as Phase A's 0018. This *is*
        `docs/player-torrent-roadmap.md`'s Phase 2 "playback state read path" work, folded in here
        rather than duplicated later (that other roadmap's `subtitle_offset_ms` addition is still
        its own future migration, untouched).
  - [x] Unplanned but load-bearing fix bundled into the same migration: `account_playback_states`'
        unique key (`account_id, installment_id, episode_id`) is now `UNIQUE NULLS NOT DISTINCT`.
        Every movie/special row has `episode_id = null`, and plain Postgres uniqueness treats two
        NULLs as distinct — so every progress write for the same film was silently *inserting a
        new row* instead of updating the one row a movie is supposed to have. Phase B's own
        single-row `GET`/upsert endpoints depend on that not happening, so this was fixed here
        rather than filed separately.
- [x] API (`apps/api/src/features/social/routes.ts`):
  - [x] `PUT /api/v1/me/playback` now accepts `durationSeconds`; the server computes `isPlayed`
        via `nextIsPlayed()`/`AUTO_WATCHED_THRESHOLD` (`@arcadia/domain`) unless `playedManually`
        is already set, in which case the stored value is kept as-is.
  - [x] `PATCH /api/v1/me/playback/:installmentId/played` — explicit mark watched/unwatched
        (`{ episodeId, isPlayed }` body), sets `playedManually=true`.
  - [x] Read endpoints: `GET /api/v1/me/playback/:installmentId?episodeId=` (single row, or
        `null`) and `GET /api/v1/me/playback` — with `?titleId=` for every row under one title
        (drives the episode watched map/series badge below), or without it for "continue
        watching" (in-progress, not-yet-played rows, newest first). Both visibility-checked the
        same way as the existing `PUT`.
  - [x] `PATCH /api/v1/titles/:titleId/playback/played` — bulk mark watched/unwatched, one row per
        movie/episode in a single transaction; `{ installmentId: null, isPlayed }` marks the whole
        title, `{ installmentId, isPlayed }` scopes to one season (or one movie).
- [x] Contracts: `upsertPlaybackInputSchema` gets `durationSeconds` (its old `completed` field is
      gone — the server derives `isPlayed`, callers never send it); new `accountPlaybackStateSchema`
      (read shape), `markPlayedInputSchema`, `bulkMarkPlayedInputSchema`. `pnpm client:generate`
      run and produces **no diff**: none of the social/library/playback routes are
      `app.openapi()`-registered (same as every other endpoint in that file), so the generated
      OpenAPI client was never going to reflect this shape either way — confirmed rather than
      assumed.
- [x] Web — player (`apps/web/src/features/library/player-page.tsx`): persists
      `positionSeconds`/`durationSeconds` via `PUT /api/v1/me/playback` on pause, on leaving the
      route, and on a 20-second interval while playing — held behind a ref (like the existing
      `wakeControls` pattern in the same file) so the write path never re-triggers the
      streaming-start effect. **Deliberately not done:** resuming from the saved position on open
      (the read half) — not in this phase's own checklist line (only referenced in the schema note
      above as "the same migration also covers it"); `GET /api/v1/me/playback/:installmentId`
      exists and this is a trivial follow-up whenever it's wanted.
- [x] Web — surfaces with a watched/unwatched affordance, in
      `apps/web/src/features/platform/work-detail-page.tsx`'s episodes tab:
  - [x] Episode list rows (`EpisodeCard`) get an independent checkmark toggle button, overlaid on
        the existing disabled play affordance (episodes have no playable source yet — this tracks
        watched state regardless); movie/season selector cards show a filled checkmark badge when
        watched.
  - [x] Season header: "وضع علامة الموسم كمُشاهَد" bulk action (and its movie equivalent, a
        watched/unwatched toggle button next to the film's play button).
  - [x] Series-level progress badge (`N من M تمّت مشاهدته`) shown in the episodes tab, computed on
        each render from the fetched playback rows plus `structure.seasons`/`units` — a movie
        counts as one trackable unit, a season's units are its episodes; nothing is stored on
        `titles`. (Scope note: the equivalent "movie card" checkmark in `OverviewSection`'s
        separate installment-poster scroller was left untouched to keep this diff to one
        component; the episodes-tab selector strip already covers every movie/season.)
- [x] Threshold hardcoded as `AUTO_WATCHED_THRESHOLD` in `packages/domain/src/playback.ts` (90%,
      see Open Questions below), imported by both the API (`nextIsPlayed()`) and available to any
      future client-side display — not duplicated.

## Phase C — Watch-button gating

**Goal:** the play button never leads to a guaranteed dead end.

- [ ] `soleFilmInstallmentId()` (`work-detail-page.tsx`) and wherever else
      `PlayFilmButton`/`playableInstallmentId` is computed: also require `releaseStatus !==
      "announced"` (and a real release date not in the future) **and** the installment carries an
      `imdbId` or `tmdbId`.
- [ ] When gating fails, disable the button with a tooltip explaining why ("لم يُصدر بعد" / "لا
      يتوفر معرّف تشغيل بعد"), consistent with how `PlayFilmButton` already handles the
      non-desktop-shell case.
- [ ] Apply the same rule to the episode-tab per-installment play affordances, not just the hero
      button.
- [ ] Regression test: a film with no `imdb_id`/`tmdb_id`, and one with `releaseStatus:
      "announced"`, both render a disabled control, not a link into `/player/...` that 404s
      server-side.

## Phase D — My Space (`/archive`) redesign

**Goal:** the family-archive hub becomes a real personal dashboard, built on Phase B's real
progress data.

- [ ] Remove the Collections tab/panel from the dashboard (confirm: keep or fully delete the
      underlying `collections` feature/table used elsewhere, e.g. "add to collection" from a title
      page — see Open Questions).
- [ ] Overview: replace the "قيد المشاهدة" stat (Phase A removed its source) with real numbers
      from Phase B — in-progress count, watched-this-month, total hours watched.
- [ ] New **Continue watching / Up next** row: resume-in-progress titles + next unwatched episode
      per followed series, driven by `account_playback_states`.
- [ ] New **"scored by me"** view: everything with a `personalRating` set, sortable/filterable —
      the piece that survives from the old Library panel once status is gone.
- [ ] Favorites shelf: keep, restyle as a poster row instead of the current list+badge layout.
- [ ] Family panel → **feed view** (AniList-style): recent comments, ratings, and
      `comment_reactions` across the family's visible titles, newest first. Build it as a
      component reusable as a sidebar (design it standalone from the start, mount it in the main
      panel and as a sidebar slot elsewhere).
- [ ] New **active torrents/downloads widget**: surfaces `stream_status` (progress/peers/rate) for
      anything currently streaming, per Phase 1's Rust side — needs a Tauri command exposed to the
      dashboard rather than only the player route.
- [ ] Visual pass: run this through the `frontend-design` skill once the data/widgets above exist
      — design against real content, not placeholders.

## Phase E — Arabic-first UI bugs

- [ ] **Taxonomy labels on the title page / others:** reproduce live first — open the title page
      and note exactly which genre/tag/tone shows wrong and what it shows instead of the Arabic
      label (raw slug? English? blank?). `work-detail-page.tsx` calls `taxonomyLabel("genre"/"tag",
      value)`, which checks a DB-backed map keyed `${vocabulary}:${slug}` before falling back to
      `@arcadia/i18n`'s `vocabularyFallbackLabel` — the bug is likely a vocabulary-name mismatch
      (singular vs. plural) or a slug missing from both the DB terms table and `taxonomy.ts`, not
      a systemic Arabic/English toggle. Needs a concrete repro before a fix lands.
- [ ] **Tashkeel/diacritics rendering broken only in Tauri:** WebKitGTK text-shaping issue
      introduced by the desktop migration, unrelated to the above. Investigate: the font stack for
      Arabic text (does it differ from the browser build?), whether a
      `font-feature-settings`/`unicode-range` rule strips combining marks, and whether it's
      WebKitGTK's HarfBuzz version on this system vs. Chromium's. Reproduce on a specific
      word/route, check computed styles, try an explicit Arabic web font known to shape marks
      correctly (e.g. Noto Naskh/Kufi Arabic) as a bisection step.

## Phase F — General UX/UI polish + dead-code sweep

- [ ] Sweep `apps/web` for components with no remaining imports after Phases A–D remove features
      (Library status UI, Collections panel, anything only reachable from deleted code paths) —
      grep for imports before deleting, then typecheck.
- [ ] Re-check the four tables already flagged as unproven scaffolding in
      `docs/player-torrent-roadmap.md` (`media_files`, `media_tracks`, `jellyfin_servers`,
      `jellyfin_items`) — still zero references outside `schema.ts`/tests; leave for their planned
      phases (3/5), don't delete.
- [ ] Fold in further concrete UI/UX items as they're specified — this phase is the catch-all, not
      a blank check.

---

## Open questions to settle before Phase B starts

| Question | Why it blocks | Resolution |
| --- | --- | --- |
| Auto-watched threshold: 90%, 95%, or configurable? | Named constant used by API + UI; pick one now, make configurable later if wanted. | **Settled (Phase B): 90%,** hardcoded as `AUTO_WATCHED_THRESHOLD` in `packages/domain/src/playback.ts`. The product owner declined to pin an exact number when asked directly, so this is a default chosen to match Jellyfin/Plex/Trakt's own defaults, not a confirmed product decision — revisit here first if it ever needs to change or become per-account configurable. |
| Keep the `collections` feature/table anywhere in the app, or delete it entirely with the dashboard tab? | Phase D scope — "add to collection" from a title page may or may not still exist. | Still open — Phase D. |
| `completed` column on `account_playback_states`: rename to `isPlayed`, or add new columns alongside and deprecate `completed`? | Migration shape. | **Settled (Phase B): renamed**, via a real SQL `RENAME COLUMN` in `0019_tough_zarek.sql` (not drop-and-add), so pre-Phase-B values carry forward instead of being discarded. |
| Feed sidebar (Phase D) — global (all routes) or scoped to `/archive`'s panels only for v1? | Component API shape. | Still open — Phase D. |

## Suggested order

A → B → C can land together as one foundation PR (they touch the same tables/routes). D depends
on B's data existing to design against, but can be scaffolded in parallel. E is independent —
start the taxonomy repro whenever; the diacritics bug is worth a timeboxed spike since it may
point at a one-line font/CSS fix. F trails continuously.

Every phase closes with `pnpm check`, the relevant Vitest suites, `pnpm build`, and Playwright for
anything routing/visual — per `CLAUDE.md`.
