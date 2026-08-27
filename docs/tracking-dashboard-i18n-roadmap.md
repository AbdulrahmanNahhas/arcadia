# Tracking Overhaul, Watch Gating, My Space Redesign & i18n Fixes

> **Status:** Phase A done in code (2026-08-27); **migration not yet applied — run
> `devenv shell -- pnpm db:migrate` against your dev DB before relying on this.** · Last revised
> 2026-08-27
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

**Goal:** an episode/movie is "watched" once played past a threshold, with a manual override, and
this is what "continue watching" / "up next" / series-progress badges are driven by.

- [ ] Schema — extend `account_playback_states` rather than reintroduce a status enum:
  - [ ] `durationSeconds integer` (needed to compute a percentage; currently only
        `positionSeconds` exists)
  - [ ] `isPlayed boolean not null default false` (rename semantics of the existing `completed`
        column, or add alongside and drop `completed` — pick one, don't keep both)
  - [ ] `playedManually boolean not null default false` — so an auto-set flag never gets silently
        clobbered by a later auto-recompute once the user has explicitly toggled it
  - [ ] `playedAt timestamp` (nullable)
  - [ ] Migration + note here. This *is* `docs/player-torrent-roadmap.md`'s Phase 2 "playback
        state read path" work — fold it in rather than duplicating.
- [ ] API (`apps/api/src/features/social/routes.ts`):
  - [ ] Extend `PUT /api/v1/me/playback` to accept `durationSeconds`; server computes `isPlayed =
        position/duration >= threshold` unless `playedManually` is set.
  - [ ] New `PATCH /api/v1/me/playback/:installmentId/played` (or similar) — explicit mark
        watched/unwatched, sets `playedManually=true`.
  - [ ] Add the missing **read** endpoints: `GET /api/v1/me/playback/:installmentId` and a list
        form for "continue watching", visibility-checked like the existing `PUT`.
  - [ ] Bulk endpoint for season/series-level "mark all watched/unwatched" (writes one row per
        episode/movie in a transaction).
- [ ] Contracts: `upsertPlaybackInputSchema` gets `durationSeconds`; new schemas for the
      mark-played and bulk endpoints; regenerate client.
- [ ] Web — player (`apps/web/src/routes/player.$installmentId.tsx` + player state hook): persist
      `durationSeconds` alongside position on pause/exit/interval.
- [ ] Web — surfaces that need a watched/unwatched affordance:
  - [ ] Episode list rows and movie cards: a Jellyfin-style checkmark toggle.
  - [ ] Season/series header: "mark season as watched" bulk action.
  - [ ] Series-level progress badge = `watched episodes / total episodes` computed from
        installment rows, not stored redundantly on `titles`.
- [ ] Decide and hardcode the threshold (see Open Questions) as a single named constant shared by
      API and any client-side display, not duplicated.

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

| Question | Why it blocks |
| --- | --- |
| Auto-watched threshold: 90%, 95%, or configurable? | Named constant used by API + UI; pick one now, make configurable later if wanted. |
| Keep the `collections` feature/table anywhere in the app, or delete it entirely with the dashboard tab? | Phase D scope — "add to collection" from a title page may or may not still exist. |
| `completed` column on `account_playback_states`: rename to `isPlayed`, or add new columns alongside and deprecate `completed`? | Migration shape. |
| Feed sidebar (Phase D) — global (all routes) or scoped to `/archive`'s panels only for v1? | Component API shape. |

## Suggested order

A → B → C can land together as one foundation PR (they touch the same tables/routes). D depends
on B's data existing to design against, but can be scaffolded in parallel. E is independent —
start the taxonomy repro whenever; the diacritics bug is worth a timeboxed spike since it may
point at a one-line font/CSS fix. F trails continuously.

Every phase closes with `pnpm check`, the relevant Vitest suites, `pnpm build`, and Playwright for
anything routing/visual — per `CLAUDE.md`.
