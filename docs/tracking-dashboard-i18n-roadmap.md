# Tracking Overhaul, Watch Gating, My Space Redesign & i18n Fixes

> **Status:** Phases A, B, C done, migrations 0018/0019 applied to the dev DB. Phase E's
> genre/tag/tone/audience/country translation bug (title page + catalog filters) is fixed and
> verified live; the Tauri-only tashkeel rendering bug is still open. Phase D is in progress.
> Last revised 2026-08-28
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
      streaming-start effect.
- [x] **Resume-on-open (the read half), closed out:** `getPlaybackForInstallment()`
      (`features/social/api.ts`) fetches the saved row in parallel with stream resolution
      (fire-and-forget — a single DB read that's always done before mpv reports a first frame);
      consumed once on the first `fileLoaded` event via `desktopPlayer.seek()`, then cleared so a
      candidate-failover reload or the viewer's own seek never re-applies it. Skipped when the
      saved position is under 15 s or within 30 s of the known duration (nothing to resume).
      Surfaced in the UI as a "متابعة من …" center-feedback badge (`FeedbackEvent`'s new `"resume"`
      kind in `player-controls.tsx`), matching the existing play/pause/volume/lock cues.
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

**Status:** Done (2026-08-27)

**Goal:** the play button never leads to a guaranteed dead end.

- [x] `soleFilmInstallmentId()` renamed `soleFilmInstallment()` (`work-detail-page.tsx`) now
      returns the installment itself, not just its id, and every `PlayFilmButton` call site
      (hero, episode-tab) forwards `releaseStatus`/`releaseAt`/`imdbId`/`tmdbId` into it. The
      gating rule itself lives in one place — `unplayableReason()` in
      `apps/web/src/features/library/play-button.tsx` — and requires `releaseStatus !==
      "announced"`, a non-null `releaseAt` that isn't in the future, **and** an `imdbId` or
      `tmdbId`. `PlayFilmButton` calls it before the existing desktop-shell check, so an
      unplayable installment is reported as such even inside the desktop app.
- [x] Gating failures render a disabled `Button` inside the existing `Tooltip` composition
      ("لم يُصدر بعد" for unreleased/no-date/future-date/announced, "لا يتوفر معرّف تشغيل بعد"
      for released-but-no-id), matching the pre-existing non-desktop-shell treatment exactly —
      same component, just a different reason string. **Found and fixed while verifying with a
      real hover in Playwright:** the pre-existing pattern used a native `disabled` attribute,
      which makes Chromium (and the Button's own `disabled:pointer-events-none` class) drop all
      pointer/focus events before they reach the `Tooltip`, so no disabled `PlayFilmButton` —
      including the original non-desktop-shell one — could ever actually show its tooltip on
      hover. Fixed by rendering with Base UI's `focusableWhenDisabled` (keeps a real,
      event-receiving `<button>` with `aria-disabled` instead of native `disabled`; Base UI's own
      click/keydown guards still block activation, so it stays exactly as inert) plus
      `aria-disabled:opacity-50` styling, factored into one `DisabledPlayButton` helper used by
      all three disabled reasons. Confirmed with a real (non-forced) Playwright hover against
      fixture rows before removing the throwaway spec and fixture titles.
- [x] Episode-tab per-installment card (`EpisodesSection`'s movie/special `PlayFilmButton`) routes
      through the same `unplayableReason()`/`PlayFilmButton` gating — confirmed disabled with the
      correct tooltip in the same manual Playwright pass.
- [x] Regression test: `apps/web/src/features/library/play-button.test.ts` covers
      `unplayableReason()` directly (the single source of truth both call sites read) — a film
      with no `imdbId`/`tmdbId`, one with `releaseStatus: "announced"`, one with no/future
      `releaseAt`, and the priority between reasons when more than one applies. No React
      Testing Library/jsdom exists anywhere in this repo (`apps/web` has zero `.test.tsx` files),
      so a full component-render regression test would have meant introducing that whole harness
      for one test — out of proportion to this phase. Real DOM rendering (disabled control,
      correct tooltip, zero `/player/...` links) for both required scenarios plus the
      episode-tab card was hand-verified with a temporary Playwright spec against real catalog
      rows created via `./bin/arcadia work apply`, then deleted once confirmed — not left in the
      permanent suite. A later full run of the permanent `tests/smoke.spec.ts` in the same
      session failed across the board (including the login step itself) because an unrelated
      concurrent process on the shared machine had taken port 3000 out from under this worktree's
      `pnpm dev` (confirmed via `curl` — the API on 3001 stayed healthy throughout); this was an
      environment collision, not a code regression, and it postdates the passing targeted runs
      above.

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

- [x] **Taxonomy labels on the title page and the catalog filters — root-caused and fixed.**
      Reproduced live (Playwright against the real dev DB/API): `server/compat.ts`'s
      `controlledLabel()`/`labelFromSlug()`/`audience()` deliberately store the canonical
      **English** label as `Work.genres`/`.tone`/`.tags`/`.audience`/`.country` (matching the
      convention `work-card.tsx`, `work-table.tsx`, `catalog-grouping.ts`, and the admin editor
      form already rely on) — not a slug. Two call sites fed those English-label values into
      `useArabicTranslations()`'s `taxonomyLabel()`, which is a *different*, slug-keyed system
      (correct for catalog facets that get real slugs from browse endpoints elsewhere, wrong
      here): every lookup silently missed and fell back to the raw English text.
  - [x] `work-detail-page.tsx`: added `catalogTermLabel()`, translating genre/tone/tag/audience/
        country through the same English-label-keyed maps (`taxonomyLabels.*`, `tagLabelsAr`)
        everything else uses, instead of the slug-keyed system.
  - [x] `catalog-filters.tsx`: `getCatalogFacetValues()` reads facet values straight off
        `Work.genres`/`.tone`/`.tags`/`.country` too, so `CatalogFilterSidebar`/`Sheet`'s
        `labelFor()` had the identical bug. Fixed by extending the existing `fixedLabels` lookup
        (already used for ages/audiences) with the same English-label-keyed maps.
  - [x] Verified live on real catalog data: every genre/tone/tag/country chip on both the title
        page and the catalog filter sidebar now renders in Arabic.
- [x] **Tashkeel/diacritics rendering broken only in Tauri — best-effort fix applied, needs a
      human visual check on the desktop build.** Root cause theory: Tailwind's preflight emits
      `font-feature-settings: normal` on `html`. Chromium treats that as "no opinion" and shapes
      Arabic combining marks (fatha/damma/kasra/shadda/sukun/tanwin, U+064B–0652) correctly either
      way; WebKitGTK (Tauri's webview, not the browser dev server) has a known regression class
      where that explicit `normal` — rather than truly unset — changes which shaping plan it
      picks for complex scripts, detaching marks from their base letter. Fixed in
      `apps/web/src/styles.css` by explicitly requesting the GPOS mark-attachment OpenType
      features (`"mark" 1, "mkmk" 1, "ccmp" 1`) on both the sans and heading font stacks — a no-op
      for Chromium/the browser build. **Needs verification**: launch the actual Tauri desktop app
      and check the "نحّاسينما" wordmark in the header (shadda on the ح) — fastest visual check,
      renders on every route.

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
