# Local Player & Torrent Streaming — Guide & Roadmap

> **Status:** Phase 0 done (2026-08-25) · Last revised 2026-08-25 (file/line references verified
> against `d10e596`; crate versions checked the same day)
> **Updating this doc:** tick checkboxes as tasks land; set each phase's status to
> `Done (YYYY-MM-DD)` when its acceptance criteria pass.

A native, hardware-accelerated video player inside the Tauri app that streams **movies** from the
family's Torrentio-compatible addon, with subtitles + offset control, picture-in-picture,
download-to-keep, and later Chromecast, Jellyfin, and debrid.

Torrents **stream by default**. Only an explicit "download" keeps the file on disk.
Linux (NixOS + Fedora) is the priority target; Windows/macOS share the code path; Android is the
same Tauri project with one swapped playback backend (Phase 7).

**Goal restated:** when Phase 1 closes, _any_ movie in the catalog that has a torrent should play —
not one hand-prepared demo title. That single sentence is what makes Phase 0.5 (bulk identifier
backfill) mandatory rather than optional, and what drives the candidate-failover and
acceptance-sampling requirements in Phase 1.

---

# The stream source

The family server runs a **Torrentio-compatible Stremio addon**. It speaks the standard Stremio
addon protocol, so everything below follows that spec.

## Request

```http
GET https://nahhas-arcadia.family.fun/{config}/stream/{type}/{id}.json
```

- `{type}` — `movie` or `series`.
- `{id}` — The media identifier.
- For movies: IMDb id **with the `tt` prefix** (e.g., `tt0133093`) or TMDB id **with the `tmdb:` prefix** (e.g., `tmdb:603`).
- For series: `{imdbId}:{season}:{episode}` (e.g., `tt0944947:1:1`).

> **Verify the `tmdb:` form against the family addon before designing around it.** IMDb is the id
> type every Torrentio deployment supports; `tmdb:` prefixed ids depend on the deployment's id
> mapping and may return an empty `streams` array rather than an error. First task of Phase 0.5 is
> one `curl` against a known film with both id forms, recorded here as a fixture. If `tmdb:` works
> it widens coverage cheaply; if it does not, nothing is lost — TMDB is still the _route_ to the
> IMDb id (`/movie/{id}/external_ids` returns `imdb_id`), it just stops being a runtime fallback.
>
> **Anime is the other id gap.** Torrentio resolves much of its anime catalogue through **Kitsu**
> ids (`kitsu:<id>` / `kitsu:<id>:<ep>`), not IMDb. Anime _films_ usually do have IMDb ids and
> should be fine, but expect a residue that only resolves via Kitsu. A `kitsu_id` column is
> deferred (see "Deferred"); the Phase 0.5 coverage report must count anime-film misses separately
> so the size of that residue is known rather than guessed.

- `{config}` — pipe-separated options, URL-encoded (`|` → `%7C`). Currently in use:
  `qualityfilter=cam,480p`.

Torrentio config keys worth knowing, since the whole path should be **env-configurable** rather
than hardcoded:

| Key                        | Example                    | Effect                                                         |
| -------------------------- | -------------------------- | -------------------------------------------------------------- |
| `providers`                | `providers=yts,eztv,1337x` | Which indexers to search                                       |
| `sort`                     | `sort=qualitysize`         | Result ordering (`qualitysize`, `seeders`, `size`, `quality`)  |
| `qualityfilter`            | `qualityfilter=cam,480p`   | Excluded qualities (`cam`, `scr`, `480p`, `threed`, `unknown`) |
| `limit`                    | `limit=10`                 | Max results per quality                                        |
| `language`                 | `language=english`         | **Priority** language, not a hard filter                       |
| `realdebrid` / `alldebrid` | `realdebrid=KEY`           | See Phase 6                                                    |

Full example:
`/providers=yts,1337x%7Csort=qualitysize%7Cqualityfilter=cam,480p%7Climit=10/stream/movie/tt0133093.json`

## Response

```jsonc
{
  "streams": [
    {
      "name": "NahhasArcadia\n1080p", // provider + quality, newline-separated
      "title": "The.Matrix.1999.1080p...\n👤 150 💾 2.1 GB ⚙️ YTS", // deprecated, still sent
      "description": "…", // spec replacement for `title` — handle both
      "infoHash": "a1b2c3…", // 40-char hex
      "fileIdx": 0, // index into the torrent's file list
      "sources": ["tracker:udp://tracker.opentrackr.org:1337/announce", "dht:a1b2c3…"],
      "behaviorHints": {
        "bingeGroup": "nahhasarcadia|1080p|…",
        "filename": "The.Matrix.1999.1080p.BluRay.x264.mkv",
        "videoSize": 2254857830,
        "videoHash": "8e245d9679d31e12", // OpenSubtitles hash — see Phase 2
      },
    },
  ],
}
```

Field semantics that matter to the implementation:

- **`sources` is not optional in practice.** It carries the tracker list; entries are
  `tracker:<http|udp>://host:port/path` or `dht:<hash>`. Every `tracker:` entry must be turned into
  a `&tr=` parameter on the magnet, or peer discovery falls back to DHT alone and start-up is slow
  or fails outright. `dht:` entries need no handling — librqbit's DHT covers it.
- **`fileIdx` selects the video inside a multi-file torrent.** Per spec, when it's absent, the
  largest file is the correct choice.
- **`behaviorHints.filename`** is the reliable name for subtitle matching; prefer it over parsing
  `title`.
- **`behaviorHints.videoHash` + `videoSize**` are the OpenSubtitles hash pair — exactly what Phase 2
  needs for accurate subtitle matching, when the addon supplies them.
- **`title` is deprecated in favour of `description**`, but Torrentio still sends `title`. Read
  `description ?? title`.
- Quality, seeders, size, and language are **only** present as free text/emoji inside
  `name`/`title` — there are no structured fields. Parsing them is a heuristic and needs tests.

## Magnet construction

```text
magnet:?xt=urn:btih:{infoHash}
       &dn={URL_ENCODED_behaviorHints.filename}
       &tr={URL_ENCODED_tracker_1}&tr={URL_ENCODED_tracker_2}... (append a separate &tr= for each valid tracker)
```

_Note: You must URL-encode the `dn` (Display Name) and `tr` (Tracker URL) values when constructing the magnet link, otherwise special characters will break the URI format._

---

# Architecture

**Discovery in the API. Transfer and playback in Tauri.**

- **API** (`apps/api/src/integrations/torrent-source.ts`) calls the addon, parses, filters, ranks,
  and returns typed candidates. Keeps the family server URL and any future debrid key out of a
  shipped desktop binary, puts the account visibility check where the session already is, and lets
  results be cached across family members.
- **Rust backend** owns [`librqbit`](https://crates.io/crates/librqbit) (pure Rust, embeddable;
  **sequential download is its default and only mode**; `Api::api_stream(id, file_idx)` hands back
  a `FileStream` that re-prioritises pieces on seek) and the libmpv engine.
- **mpv** plays `http://127.0.0.1:<port>/stream/<id>` directly.
- **React** renders every control over a transparent webview. There is no `<video>` element
  anywhere in this design.

**Playback engine: embedded libmpv**, `vo=gpu-next` + `hwdec=auto-safe` — hardware decode
(VAAPI/NVDEC on Linux, D3D11VA on Windows, VideoToolbox on macOS) and every codec ffmpeg supports,
so HEVC/x265, AV1 and 10-bit all play and **the ranker never needs to filter by codec**. Rust
binding: the maintained [`libmpv2`](https://crates.io/crates/libmpv2) crate.

Do **not** depend on the published Tauri mpv plugins:
[`nini22P/tauri-plugin-libmpv`](https://github.com/nini22P/tauri-plugin-libmpv) documents Linux
window embedding as _not working_; `tauri-plugin-mpv` drives an external process over JSON-IPC and
is Windows-tested only. The working reference is
[MaxVideoPlayer](https://github.com/MaxMB15/MaxVideoPlayer), which ships `.deb`/`.rpm`/`.AppImage`
with a custom in-repo plugin: libmpv in-process behind a `PlatformRenderer` trait — EGL + X11 child
window / Wayland subsurface on Linux with VAAPI/NVDEC working, `NSOpenGLView` on macOS. Follow that
shape.

## Tauri 2 shape — the modern idioms this feature must use

The desktop shell today is a bare scaffold: `lib.rs` registers one plugin and **zero commands**,
`capabilities/default.json` grants only `core:default`, and `Cargo.toml` has no release profile.
Everything below is new ground, so get the current idioms right the first time.

| Concern             | Do this                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Async runtime       | **Reuse Tauri's runtime** — `tauri::async_runtime` _is_ tokio. Build the librqbit `Session` inside `setup` on that runtime (`tauri::async_runtime::spawn`) instead of standing up a second multi-thread runtime; two runtimes means two thread pools competing for cores during playback.                                                                                                           |
| State               | `app.manage(PlayerState { … })` + `State<'_, PlayerState>` in commands. Interior mutability via `tokio::sync::Mutex` (never `std::sync::Mutex` across an `.await`).                                                                                                                                                                                                                                 |
| Commands            | `#[tauri::command] async fn …` returning `Result<T, PlayerError>` where `PlayerError: serde::Serialize` — typed errors reach the frontend as structured values, not stringified panics.                                                                                                                                                                                                             |
| High-frequency data | **`tauri::ipc::Channel<T>`**, not `emit`/`listen`. `time-pos`, cache state and torrent progress are per-second-or-faster streams; a Channel is a direct, ordered, single-consumer pipe, while `emit` broadcasts to every webview and re-serialises per listener. Use `emit` only for rare one-shot lifecycle events.                                                                                |
| Permissions         | Commands defined in **this crate** and registered with `generate_handler!` need **no capability entry** — the ACL gates _plugin_ commands and core APIs. Capability entries are only needed for the core APIs the player actually calls (window fullscreen/always-on-top, fs paths for downloads, opener). Grant those narrowly; do not widen `default.json` to `core:default` plus a shotgun list. |
| Raw window handles  | `window.gtk_window()` / `window.default_vbox()` on Linux via `tauri::window::WindowExt` (the `gtk` feature) is how the mpv surface gets parented — not `raw_window_handle` guesswork.                                                                                                                                                                                                               |
| Cleanup             | `WindowEvent::CloseRequested` **and** `RunEvent::ExitRequested` — the player and torrent session must be torn down on both paths, plus `Drop` on the state as the backstop.                                                                                                                                                                                                                         |

**Version floor (checked 2026-08-25).** `src-tauri/Cargo.toml` currently pins `tauri = 2.11.3`,
`edition = "2021"`, `rust-version = "1.77.2"` and defines no `[profile.release]`.

- [ ] `tauri` → **2.11.5**, `tauri-build` → matching 2.6.x.
- [ ] `librqbit = "9"` (latest **9.0.1**), `libmpv2 = "6"` (latest **6.0.0**) — both need a modern
      toolchain; `rust-version = "1.77.2"` will not build them.
- [ ] `edition = "2024"`, `rust-version = "1.85"`. The existing
      `unsafe { std::env::set_var("GDK_BACKEND", "x11") }` in `main.rs` is already written in the
      2024-compatible form, so the edition bump is mechanical.
- [ ] Add a release profile — absent today, and the difference is large for a binary that now
      contains ffmpeg-adjacent bindings and a BitTorrent stack:

  ```toml
  [profile.release]
  opt-level = 3
  lto = "thin"
  codegen-units = 1
  panic = "abort"
  strip = true
  ```

- [ ] Add `cargo clippy -- -D warnings` and `cargo fmt --check` to the pre-handoff routine;
      `pnpm check` covers only the TypeScript side today, and this feature makes Rust the
      larger risk surface.

**Resolver interface — fixed in Phase 1 so later sources are additive:**

```ts
resolve(installment) -> { kind: "local" | "jellyfin" | "torrent" | "debrid", url: string }
```

Priority now: `local → torrent`. Later: `local → jellyfin → debrid → torrent`.

---

# Performance targets and the rules that protect them

Numbers to hold the implementation to, plus the specific decisions that decide whether they are
met. Measure them; do not assume them.

| Target                                           | Budget                                                                                                                              |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| Click `تشغيل الفيلم` → first frame (well-seeded) | **< 15 s** (addon call < 2 s, metadata < 5 s, prebuffer the rest)                                                                   |
| Seek within already-downloaded range             | **< 300 ms**                                                                                                                        |
| Seek into an undownloaded range                  | **< 8 s** to resume, with an honest "buffering" state, never a frozen UI                                                            |
| Overlay UI cost during playback                  | **< 5 % CPU**, zero React re-renders per `time-pos` tick                                                                            |
| Hardware decode                                  | `hwdec-current` is a real decoder on every supported machine; a software-decode fallback is a **logged warning**, not a silent pass |

**Decode.** `hwdec=auto-safe` + `vo=gpu-next`. Add `vd-lavc-dr=yes` (direct rendering into
decoder-owned buffers) and leave `interpolation=no` — interpolation costs GPU for no benefit on a
family TV-distance display. Read back `hwdec-current`, never `hwdec` (which only reports what was
_requested_).

**Network cache.** Torrent-backed HTTP behaves nothing like a CDN, and mpv's defaults assume a
CDN. Set explicitly at load: `cache=yes`, `demuxer-max-bytes` ≈ 256 MiB,
`demuxer-max-back-bytes` ≈ 128 MiB, `demuxer-readahead-secs` ≈ 60, `cache-pause=yes` with
`cache-pause-wait` ≈ 3, `hr-seek=yes`, and a generous `network-timeout`. Undersized demuxer
buffers are the single most common cause of "it stutters every 20 seconds" on torrent streams.
These are the values to _start_ from and then measure, not folklore to copy blindly.

**The overlay is the sneaky cost.** A transparent WebKitGTK surface composited over a video plane
repaints on every React commit, and a naive player re-renders the whole control bar 30–60 times a
second.

- Throttle `time-pos` to **4 Hz** on the Rust side before it ever crosses the IPC boundary.
- Drive the scrubber from a `ref` + CSS `transform`/`width` write inside `requestAnimationFrame`.
  Position must **not** live in React state.
- When controls are hidden, the overlay must be `pointer-events: none` and ideally
  `visibility: hidden` — a fully transparent but still-composited DOM tree keeps costing.
- Keep the overlay DOM small and flat; no heavy `backdrop-filter` over the video plane during
  playback.

**Torrent side.** `only_files: [file_idx]` so nothing else is fetched; enable `fastresume`;
cap peers per torrent rather than leaving it unbounded; and keep exactly **one** streaming torrent
active at a time in Phase 1 (starting a second play tears the first down).

**API side.** Addon responses are keyed by a stable id and are perfectly cacheable — an in-process
TTL cache (~15 min) plus a hard `AbortSignal.timeout` (~8 s) on the upstream fetch. Two family
members opening the same film should produce one addon call.

---

# Database migration

**Run by the user, not the agent.** Five typed id columns on both `titles` and `installments`, so a
franchise title and its installments each carry their own (Demon Slayer: title holds
`anilist_id`/`mal_id`/`tvdb_id`; each film holds its own `tmdb_id`/`imdb_id`). Also matches
Jellyfin's `ProviderIds: { Tmdb, Imdb, Tvdb, … }` for Phase 5.

Keep the `external_identities` **table name** — renaming touches ~12 files across `packages/cli`,
the admin JSON editor (where `title.externalIdentities` is a user-facing field name), `compat.ts`,
the v1 importer and tests. Narrow its role instead: Fanart image ids, Wikipedia, official site,
trailer URLs.

### Schema (`packages/database/src/schema.ts`)

**Done (2026-08-25).** Migration `0017_mixed_jocasta.sql`, applied to the local dev database.

- [x] Add to **both** `titles` and `installments`:
  - `tmdb_id integer`
  - `imdb_id text` — check `imdb_id is null or imdb_id ~ '^tt[0-9]{7,10}$'`
  - `tvdb_id integer`
  - `anilist_id integer`
  - `mal_id integer`
- [x] One partial unique index per column, per table (`where x_id is not null`) — 10 total.
- [x] `external_identities`: add nullable `installment_id uuid references installments(id) on
delete cascade`, make `title_id` nullable, add
      `check (num_nonnulls(title_id, installment_id) = 1)`, index `installment_id`.
- [x] `pnpm db:generate` then `pnpm db:migrate`.

Note for whoever runs the next `db:generate`: `drizzle/meta/` was missing every snapshot from
`0005` through `0016` (only `0000`–`0004` existed, despite the journal listing up to `0016`) —
`generate` was diffing against 6-migrations-stale state and throwing an interactive
table-rename prompt it can't resolve non-interactively. Fixed by reconstructing the missing
`0016_snapshot.json` from the pre-Phase-0 schema (a fresh, history-less `generate` run against
that file's content, chained onto `0004`'s id as `prevId`) before generating `0017`. If this
happens again, that's the repair recipe — regenerate the missing snapshot from the last-known
schema.ts state at that migration, don't try to hand-resolve the rename prompts.

### Data migration

**`external_identities` was empty at migration time (0 rows), so all four statements below stayed
no-ops** — confirmed after the migration landed. They remain dead code now: Phase 0's ingest fix
means `tmdb`/`anilist` never write to `external_identities` going forward (they go straight to the
typed columns), so there is nothing left for this backfill to migrate. Left in place only as a
historical note.

```sql
update titles t set tmdb_id = ei.external_id::integer
  from external_identities ei
  where ei.title_id = t.id and lower(btrim(ei.provider)) = 'tmdb'
    and ei.external_id ~ '^[0-9]+$';

update titles t set imdb_id = ei.external_id
  from external_identities ei
  where ei.title_id = t.id and lower(btrim(ei.provider)) = 'imdb'
    and ei.external_id ~ '^tt[0-9]{7,10}$';

update titles t set anilist_id = ei.external_id::integer
  from external_identities ei
  where ei.title_id = t.id and lower(btrim(ei.provider)) = 'anilist'
    and ei.external_id ~ '^[0-9]+$';

delete from external_identities
  where lower(btrim(provider)) in ('tmdb','imdb','anilist')
    and external_id !~ '^https?://';
```

### Later migrations

- [ ] Phase 0.5: `installments.id_source` + `id_confidence` (or a single
      `id_provenance jsonb`) so an automatically matched id is distinguishable from a
      human-confirmed one, and a bad batch can be re-run without clobbering manual corrections.
- [ ] Phase 2: `account_playback_states.subtitle_offset_ms` (nullable int).
- [ ] Phase 3: `media_files.origin` (`'import' | 'torrent'`) + `media_files.torrent_info_hash`.
- [ ] Phase 6: none — debrid keys belong in Tauri secure storage, not Postgres.
- [ ] Not yet: `episodes` gets no id columns until TV playback is built.
- [ ] Not yet: `kitsu_id` — only if the Phase 0.5 coverage report shows a meaningful anime-film
      residue that IMDb cannot resolve.

---

# Phase 0 — Identifiers, API, editor form

**Status:** Done (2026-08-25)
**Done when:** a movie installment can be given an IMDb id through the editor form, it survives a
save, and re-opening the form shows it. ✅ Verified both via a Vitest regression test
(`apps/api/src/features/titles/structure.test.ts`) and by hand against the live dev DB/API.

### Fix the data-loss bug first

Saving any work through the editor form used to **destroy the TMDB/AniList ids written by
artwork ingest**. Closed by moving `tmdb`/`anilist` off `external_identities` entirely onto the
five typed columns (see "Database migration" above), which nothing deletes-and-reinserts.

- [x] Fix the round trip so ingested ids survive a save.
- [x] Regression test: save a work carrying ids, assert they survive. Two added —
      `write.test.ts` (title-level) and `structure.test.ts` (installment-level, plus one asserting
      ids survive a resave that doesn't mention them at all, matching the existing
      score/award-preservation pattern).
- [x] Fix `write.ts:187` (`externalId: link.label || link.url`): now prefers the URL as the
      free-form link's identity, since the five typed ids no longer flow through this list at all.
- [x] Fix `SeasonPosterCard`'s owner bug: it no longer takes a `titleId` prop at all — it now
      passes `installmentId: season.id` straight through, so a season poster match records its
      TMDB/AniList id on that installment, not the title.
- [x] `external_identity_provider_uq` scoped per owner: the unique index is now on `(title_id,
      installment_id, lower(provider), external_id)`, so two different titles/installments can
      share a free-form link. Verified live: a duplicate `tmdb_id` across two titles now raises
      `duplicate key value violates unique constraint "titles_tmdb_id_uq"` instead of silently
      no-op'ing — Phase 0.5 must handle that conflict explicitly, as this section anticipated.
      Also fixed the CLI's `work apply externalIds` path, whose `on conflict` target no longer
      matched the new composite index (`packages/cli/src/commands/work.ts`).

### Contracts

- [x] Added `tmdbId`/`imdbId`/`tvdbId`/`anilistId`/`malId` — shared as
      `externalIdFieldsSchema`/`externalIdFieldsInputSchema` in `admin-catalog.ts`, mixed into
      `installmentSchema`/`titleDetailSchema` (read) and `adminTitleInputSchema`/
      `adminInstallmentInputSchema` (write), plus the web-side `workSchema`/
      `editableWorkSeasonSchema`. Also registered in `admin-field-registry.ts` (title + installment
      entries), which `admin-field-registry.test.ts` enforces 100% coverage of.
- [x] Kept `externalIdentities` for free-form references.
- [x] `pnpm client:generate`.

### API

- [x] `repository.ts`: selects the five columns on title and installment reads.
- [x] `titles/write.ts`: writes them via plain `update`; delete-then-reinsert now handles only
      free-form links.
- [x] `app.ts` artwork ingest: `tmdb`/`anilist` update the typed columns on the correct owner —
      title **or installment**, via a new `installmentId` field alongside `titleId` on
      `adminArtworkIngestSchema`. `fanart` keeps writing to `external_identities` (now owner-aware
      too, since that table accepts either `title_id` or `installment_id`).
- [x] `integrations/tmdb.ts`: `searchTmdbArtwork` accepts an optional `tmdbId`; when present it
      skips `/search/{mediaType}` and its "blindly take `results[0]`" risk entirely, going
      straight to `/{mediaType}/{tmdbId}/images`. The search path only runs for a row with no id
      yet — exactly the "known-id fast path" this checklist originally deferred, now done because
      the artwork picker (below) actually needed it to be trustworthy.
- [x] `integrations/anilist.ts`: same — `Media(id:)` when a known `anilistId` is passed, else
      `Media(search:)`.
- [ ] `integrations/fanart.ts`: **still deferred** — still movie-only; the TV endpoint (now
      unblocked by `tvdb_id` existing) isn't wired up yet. Lower priority than the two above since
      Fanart only contributes clear-logos, not the primary poster/banner source.

### Editor form (`apps/web/src/features/admin/components/editor-form/`)

- [x] Title-level: five explicit id fields (`IdField`), with "open on site" links, next to the
      now-narrower free-form external-links textarea. **Shown only when the title is anime-kind**
      (has season-kind installments) — a movie-collection title (Hotel Transylvania) has no
      single TMDB/IMDb entry of its own, only its individual films do, so the section is replaced
      with a one-line pointer to the per-installment fields instead of five permanently-empty
      inputs.
- [x] Per-installment: added to `SeasonPosterCard` (immediate-save, matching how its poster field
      already works), **contextual by installment kind and title kind** rather than always
      showing all five:
      - `season`-kind installments (an anime's numbered seasons) show **AniList + MAL only** —
        Stremio/Torrentio resolve TV content as `{title's imdbId}:{season}:{episode}`, so a
        season has no TMDB/IMDb match of its own to enter; AniList/MAL, by contrast, id anime per
        season, so those two are exactly what's missing at title level.
      - `movie`/`special`-kind installments show **TMDB + IMDb always** (this is the field Phase 1
        actually depends on), **plus AniList + MAL only if the title is anime-kind** — a Demon
        Slayer movie has both (it's an anime film with its own AniList entry); a Hotel
        Transylvania film only has TMDB/IMDb.
      - `tvdb_id` isn't exposed in either UI (title or installment) — TheTVDB only really models
        whole series, not sub-seasons or standalone films, and matters here solely for Fanart's
        TV clear-logo endpoint, which is title-level. The column still exists for that later use.
      This resolves the exact split a mixed-structure title needs (Demon Slayer: seasons 1–4/5
      use the title's own IMDb id with season/episode numbers; the movie entries — Mugen Train,
      etc. — each carry their own TMDB/IMDb, plus their own AniList/MAL like any anime entry).
- [x] Free-form reference-links list (Wikipedia, official site, trailer) — the existing textarea,
      narrowed: its help text now says not to put TMDB/IMDb/AniList ids there.
- [x] Artwork search (`ArtworkPickerDialog`, used by both the title-level `ArtworkField` and
      `SeasonPosterCard`) now passes whatever known `tmdbId`/`anilistId` the row already has
      through to `searchArtwork` → the two provider fast paths above, and shows "نتائج دقيقة عبر
      المعرّف المحفوظ" instead of a text search box when one exists. This was flagged mid-review as
      still doing a blind fuzzy search after the rest of Phase 0 landed — fixed same-day.
- [ ] "Look up" affordance (title+year → candidate matches → confirm and write all ids at once):
      **still deferred** — real UI scope of its own; Phase 0.5's bulk matcher supersedes the need
      for it as the primary path, so it's "nice to have" rather than blocking. The artwork
      picker's known-id fast path above covers the "id already set" half of this; what's still
      missing is a dedicated flow to *find* the id in the first place from inside the editor form.
- [x] JSON editor (`json-editor/engine.ts`, `guide.ts`) and CLI (`work apply`) kept in sync:
      `guide.ts` is generated from `admin-field-registry.ts` so it needed no direct edit; found and
      fixed a real bug in `engine.ts`'s `mergeStructureProjection` while doing this — its rebuilt
      installment object didn't seed the five id fields from the original row, so any JSON-editor
      structure save (with a structure field selected) would have silently nulled every
      installment's ids via `editableWorkStructureSchema`'s `.default(null)`. The CLI's
      `workDocument`/`upsertTitle`/`syncInstallments` got the same optional five fields, "only
      touch what's present" like every other field there.
- [x] Replaced the fragile trailer lookup in `work-detail-page.tsx` (`/trailer|إعلان|يوتيوب|youtube/i`
      over `provider + label`) with an exact match on the reserved provider slug `"trailer"`.

---

# Phase 0.5 — Backfill identifiers for the whole catalog

**Status:** Not started
**Done when:** a coverage report shows **≥ 95 % of the 110 movie installments carry a validated
`imdb_id`**, every automatic match below the confidence threshold has been human-confirmed or
explicitly marked unresolvable, and the report is reproducible from one command.

This phase exists solely because of the "any movie, not one demo title" goal. Phase 0 gives one
admin one form; this gives the catalog ids at scale. **Phase 1 is not startable without it** — a
player that works for the single film someone typed an id into has not met the requirement.

### Matching pipeline

- [ ] CLI command in `packages/cli` — `arcadia ids backfill [--kind movie] [--dry-run] [--limit N]`,
      following the existing `--dry-run` / `--yes` / `audit_logs` conventions.
- [ ] For each movie installment, build the query from `installments.title` +
      `installments.release_date` (year), falling back to `titles.canonical_title` +
      `titles.release_year` when the installment title is generic (e.g. a single-film title where
      the installment just repeats the work name).
- [ ] TMDB `/search/movie?query=&year=` → score candidates on **title similarity × year distance**;
      also compare against `title_aliases` (the catalog is Arabic-first, so the stored
      `canonical_title` may not be the TMDB primary title — English aliases matter here).
- [ ] Resolve the winner through `/movie/{id}/external_ids` to get `imdb_id`, and write **both**
      `tmdb_id` and `imdb_id` onto the installment.
- [ ] Record match confidence and source (`id_source`/`id_confidence`) so a re-run does not
      overwrite human-confirmed values.
- [ ] Rate-limit and cache TMDB calls; 110 lookups is small, but the same code will be re-run.
- [ ] Reuse/extend `integrations/tmdb.ts` rather than adding a parallel client — but note that
      today it takes `results[0]` blindly (`tmdb.ts:60`), which is exactly the behaviour that must
      **not** be used for identity resolution. Scoring is the point of this phase.

### Review and reporting

- [ ] `arcadia ids report` (or a `stats coverage` preset): counts by state —
      matched-high-confidence / matched-low-confidence / unmatched / conflicting, **broken out for
      anime films** so the Kitsu residue is measured.
- [ ] Admin review surface for the low-confidence tail: candidate list, poster + year + overview,
      one click to confirm. Reuse the Phase 0 "Look up" affordance rather than building a second UI.
- [ ] Explicit "no external id exists" marker so unresolvable works (family recordings, obscure
      titles) stop appearing in the report forever.
- [ ] Conflict handling for two installments resolving to the same `imdb_id` — surfaced, never
      silently dropped.

### Verification

- [ ] Hand-check a random sample of 15 matches against the actual films. An automatic matcher that
      is 90 % right and silently 10 % wrong produces a player that confidently streams the wrong
      movie — worse than one that says "no id".
- [ ] Record the addon fixture: one `curl` per id form (`tt…`, `tmdb:…`) against the family addon,
      saved under test fixtures, resolving the open question from "The stream source".

---

# Phase 1 — Play a movie, end to end

**Status:** Not started
**Done when:** **10 movies picked at random from the catalog** (not hand-chosen) each open from
`تشغيل الفيلم`, reach first frame inside the Performance-targets budget, seek correctly, report an
active hardware decoder, and tear the torrent session down cleanly on close — and the ones that
_cannot_ play fail with a specific, honest message (no id / no streams / no peers), never a spinner
that never resolves. A single demo film playing is **not** this phase.

Ordered so each step is verifiable before the next depends on it.

### 1.1 Environment

- [ ] Add to `devenv.nix`: `mpv`, `libmpv` (headers for `libmpv2-sys`), `libGL`, `libva`,
      `libvdpau`, `pkg-config`.
- [ ] Add GStreamer — **not for the player** (mpv uses ffmpeg internally) but for the webview: the
      YouTube trailer iframe at `work-detail-page.tsx:476` plays media inside WebKitGTK, and
      `devenv.nix` currently has no GStreamer packages at all.

  ```nix
  packages = with pkgs; [
    # … existing …
    mpv libmpv libGL libva libvdpau
    gst_all_1.gstreamer
    gst_all_1.gst-plugins-base
    gst_all_1.gst-plugins-good
    gst_all_1.gst-plugins-bad
    gst_all_1.gst-libav
  ];

  # Same reason as the existing GIO_EXTRA_MODULES entry — devenv's plain `packages` list doesn't
  # run the module-registration setup hooks, so plugin paths must be set explicitly.
  env.GST_PLUGIN_SYSTEM_PATH_1_0 = lib.makeSearchPathOutput "lib" "lib/gstreamer-1.0" [
    pkgs.gst_all_1.gstreamer
    pkgs.gst_all_1.gst-plugins-base
    pkgs.gst_all_1.gst-plugins-good
    pkgs.gst_all_1.gst-plugins-bad
    pkgs.gst_all_1.gst-libav
  ];
  ```

- [ ] Document the Fedora runtime requirement (`mpv-libs`, `libva` + VAAPI driver).

### 1.2 mpv renders a local file inside the Tauri window

The riskiest step — test with a local test file before adding any torrent or streaming logic.

- [ ] Add `libmpv2 = "6"` to `src-tauri/Cargo.toml` (and make the edition/toolchain/profile changes
      from "Tauri 2 shape" in the same commit — they are prerequisites, not cleanup).
- [ ] `src-tauri/src/player/mod.rs`: `MpvEngine` owning the `libmpv` handle plus its event loop on a dedicated thread.
- [ ] MPV Init options: `vo=gpu-next`, `hwdec=auto-safe`, `gpu-api=auto`, `keep-open=yes`, `osc=no`, `input-default-bindings=no`, `input-vo-keyboard=no` — React owns all UI and keyboard inputs.
- [ ] Cache/decode options from "Performance targets" (`cache`, `demuxer-max-bytes`,
      `demuxer-readahead-secs`, `cache-pause`, `hr-seek`, `vd-lavc-dr`) — set at init, not
      discovered later when playback stutters.
- [ ] **Linux Windowing (XWayland Strategy):** Keep `GDK_BACKEND=x11` in `src-tauri/src/main.rs`. This ensures robust cross-compositor compatibility (Niri, GNOME, KDE Wayland sessions via XWayland) by providing a stable X11 Window ID (`wid`) for `libmpv`.
- [ ] **Composition via `gtk::Overlay`:**
  - Base child: Native video render surface (`gtk::DrawingArea` / X11 window) receiving the `wid` from `libmpv`.
  - Overlay child: Tauri Webview sitting directly on top.
- [ ] **Webview Transparency:** Set `"transparent": true` in `tauri.conf.json` and `body { background: transparent; }` in CSS. This only makes the HTML background see-through so the mpv video layer underneath is visible (OS-level window transparency/PiP is explicitly disabled).
- [ ] **UI Controls & Fullscreen Behavior:**
  - React UI floats on top of the video layer.
  - Implement mouse-inactivity auto-hide (controls fade out after 2.5s of no cursor movement).
  - Add Fullscreen toggle triggered via Tauri's window API (`app_handle.fullscreen()`).
- [ ] Keep the video surface positioned and resized in sync with window resize events.
- [ ] Confirm `hwdec-current` (not `hwdec`) reports an active hardware decoder (e.g., `vaapi` or `nvdec`).
- [ ] **Checkpoint:** A local `.mkv` plays with full hardware decoding, React UI overlays correctly, and controls auto-hide seamlessly on Niri/GNOME/KDE.

### 1.3 mpv control surface

- [ ] Commands: `player_load(url)`, `player_play`, `player_pause`, `player_seek(seconds)`,
      `player_set_volume`, `player_set_property(name, value)`, `player_get_property(name)`,
      `player_stop`.
- [ ] Observe and push over a **`tauri::ipc::Channel`** — never poll from JS, and don't `emit`
      per-tick: `time-pos`, `duration`, `pause`, `eof-reached`, `demuxer-cache-state`,
      `track-list`, `hwdec-current`, `idle-active`. Throttle `time-pos` to 4 Hz **in Rust**.
- [ ] Coalesce the property observations into one serialisable `PlayerEvent` enum rather than one
      channel per property — one IPC hop per tick, not eight.
- [ ] Register in `lib.rs` via `generate_handler!`. These are app-crate commands, so they need **no
      capability entry**; add capability entries only for the core APIs the player calls
      (`core:window:allow-set-fullscreen`, later always-on-top for PiP, and the app-data path used
      by the torrent session). `capabilities/default.json` currently grants only `core:default`.

### 1.4 Torrent engine

- [ ] Add `librqbit = "9"`. **No separate `tokio` runtime** — use `tauri::async_runtime` (see
      "Tauri 2 shape"); add `tokio` only for its `sync`/`io` types.
- [ ] Long-lived `Session` built once in `setup`, DHT enabled, storage dir under Tauri app-data
      (`app.path().app_cache_dir()` for streaming, `app_data_dir()` for kept downloads — they have
      different lifetimes and different backup expectations).
- [ ] `SessionOptions`: `fastresume: true`, `persistence: Some(SessionPersistenceConfig::…)` so
      Phase 3's restart-resume is a config change rather than a rewrite, and a sane `peer_limit`.
- [ ] `start_stream(info_hash, file_idx, filename, trackers) -> { id, url }`:
  - build the magnet (see "Magnet construction" — **the `tr=` entries matter**)
  - `session.add_torrent(AddTorrent::from_url(magnet), Some(AddTorrentOptions { only_files: Some(vec![file_idx]), .. }))`
  - return the local HTTP stream URL for that file
- [ ] Serve the file over a small local HTTP endpoint backed by
      `Api::api_stream(id, file_idx)` (a seekable `FileStream`), honouring `Range` — mpv needs a
      URL, so a custom `tauri://` protocol is not an option here.
- [ ] **Secure the stream server.** `127.0.0.1` is not a permission boundary — every process on the
      machine can reach it. Bind to **port 0** (ephemeral, discovered at runtime) and put a
      per-session random token in the path (`/stream/{token}/{id}`). Do not expose librqbit's full
      HTTP API (it includes torrent _control_ endpoints); serve only the read route you wrote.
- [ ] Handle the magnet→metadata resolution delay as an explicit `resolving` state; it can take
      seconds before file sizes are even known. Give it a **timeout** (~30 s) that fails over to
      the next candidate rather than hanging.
- [ ] **Candidate failover** — the thing that turns "a movie plays" into "any movie plays": if
      metadata does not resolve, or no peer connects within ~20 s, or throughput stays at zero,
      automatically try the next ranked candidate and tell the UI which attempt it is on. Give up
      only after the list is exhausted.
- [ ] `stream_status(id)` → progress, peers, download rate — pushed over the Channel, not polled.
- [ ] `stop_stream(id)`; stop **all** streams on `CloseRequested`, `ExitRequested`, and `Drop`.
- [ ] **Disk policy for "streaming".** Streaming still writes every fetched piece to disk. Without
      a policy the cache dir grows until the disk is full and "streams by default, downloads only
      on request" quietly becomes false. Decide and document: delete the torrent's data on
      `stop_stream` unless it was promoted to a download (Phase 3), plus a size-capped cache dir
      with LRU eviction on startup.
- [ ] **Seeding posture.** librqbit uploads while connected. Make it an explicit, configurable
      decision — stop seeding when playback ends, or keep seeding with a ratio cap — rather than an
      accident. Note it in the user-facing settings, since it is the family's bandwidth.
- [ ] **Checkpoint:** a known-good, freely distributable magnet (Sintel / Big Buck Bunny — keep the
      exact magnet as a checked-in test fixture) streams to mpv and plays; seeking mid-file works;
      killing the window mid-stream leaves no orphaned session and no growing cache dir.

### 1.5 API — stream discovery

- [ ] `GET /api/v1/installments/:id/streams`:
  1. resolve the stream id in order: `installments.imdb_id` → `installments.tmdb_id` as `tmdb:…`
     (only if the Phase 0.5 fixture proved the addon accepts it) → the same two on `titles` when
     the title has exactly one movie installment. Return a **specific** error code for "no id"
     versus "no streams" — the UI must be able to tell the family "this film has no identifier yet"
     rather than "unavailable".
  2. **re-check visibility** via `visibleTitleIdsForAccount` — the play button being hidden is not
     access control; without this, a restricted account that knows an installment id can resolve a
     stream for a title it cannot see
  3. call the addon, parse, rank
  4. return typed candidates including `infoHash`, `fileIdx`, `filename`, trackers, and the parsed
     quality/seeders/size
- [ ] `integrations/torrent-source.ts` following existing integration conventions: base URL **and
      config segment** from env, best-effort failure, never throws on provider error.
- [ ] Parse `sources` into a clean tracker list; drop `dht:` entries.
- [ ] Read `description ?? title`; parse quality/seeders/size out of the free-text string.
- [ ] Rank: English heuristic → resolution → seeders → size. **No codec filtering.**
- [ ] Unit-test the parser against captured fixture JSON — it is pure string parsing over
      emoji-annotated text and will break silently otherwise. Include a fixture with **missing**
      `sources`, missing `fileIdx`, and a malformed size string; the parser must degrade, not throw.
- [ ] Return **all** viable candidates ranked, not just the winner — client-side failover needs the
      list, and Phase "Deferred"'s quality picker gets it for free.
- [ ] `AbortSignal.timeout` (~8 s) on the upstream call and a ~15 min in-process response cache,
      keyed by id + config segment (see "Performance targets").
- [ ] Add the response schema to `packages/contracts`; regenerate the client.
- [ ] Handle the case where a stream carries a direct `url` instead of `infoHash` (that is what a
      debrid-configured addon returns — Phase 6 gets this for free if handled now).
- [ ] Audit-log nothing here (it is a GET), but do make sure the endpoint is under the
      authenticated `/api/v1/*` boundary, not the `health`/`invites` exemption list.

### 1.6 Web — player UI

- [ ] Add `@tauri-apps/api` (not currently a dependency; nothing references `__TAURI__` yet).
- [ ] **Guard every Tauri call behind a runtime capability check.** The same `apps/web` bundle is
      also served as a plain SPA (`pnpm dev`, Playwright); importing `@tauri-apps/api` at module
      scope in a browser context throws. Detect once, degrade to a disabled play button with a
      "متاح في تطبيق سطح المكتب" explanation — this also keeps the existing e2e suite green.
- [ ] `PlaybackResolver` implementing the resolver interface, initially `local | torrent`.
- [ ] Player route: transparent background, React controls over the native surface — play/pause,
      seek scrubber with buffered ranges, volume, fullscreen, keyboard shortcuts, RTL-correct.
      Scrubber position via `ref` + rAF, never React state (see "Performance targets").
- [ ] Buffering UI from `demuxer-cache-state` + rqbit progress; distinguish _resolving metadata_,
      _buffering_, and _stalled — no peers_.
- [ ] Error states: no IMDb id on the installment, no streams returned, all candidates dead, mpv
      failed to init, not permitted.
- [ ] Honor `account_preferences` (already wired end to end in `features/accounts/routes.ts`):
      apply `autoplay`; constrain audio-track selection to `allowedAudio`; hide track switching
      entirely when `canSwitchTracks` is false.
- [ ] Wire the existing disabled placeholders, all under `apps/web/src/features/`:
      `platform/work-detail-page.tsx:1003` (`تشغيل الفيلم`), `platform/work-detail-page.tsx:452-454`
      (`ابدأ بالمشاهدة`, currently anchors to `#family-progress`),
      `platform/components/watch-radar-hero.tsx:134` (whose tooltip still says
      "يُفعّل عند ربط هذا العمل بخادم Jellyfin" — reword, torrent comes first now). Refresh the
      badges at `admin/pages/overview-page.tsx:233` (`التشغيل مؤجل`).
- [ ] Set a real CSP in `tauri.conf.json` (currently `null`) — it must allow the local stream
      origin and the YouTube trailer iframe, so write it alongside the transparency change and test
      both.
- [ ] `"transparent": true` on the window in `tauri.conf.json`; on macOS this additionally requires
      `app.macOSPrivateApi: true` (note it now, even though macOS is not a target yet).
- [ ] Tear down the stream on route exit, window close, and app quit.
- [ ] **Packaging is part of this phase, not Phase 4.** libmpv is a large runtime dependency: the
      `.deb` needs a `Depends:` entry, the AppImage needs it bundled, and `pnpm tauri build` does
      not produce a runnable bundle on NixOS (see README). Confirm in CI that the bundled artifact
      plays a file — a player verified only under `tauri dev` is a player nobody in the family can
      install.

---

# Phase 2 — Subtitles, tracks, resume

**Status:** Not started
**Done when:** an English subtitle track can be fetched and rendered, offset adjusted live, and
both the offset and playback position are restored on reopening the film.

mpv has libass built in, so subtitles are native — no WASM subtitle stack, no JS timing shim.

### Playback state API — half of it already exists

Correction to an earlier draft: `account_playback_states` **does** have a write endpoint.
`PUT /api/v1/me/playback` lives at `apps/api/src/features/social/routes.ts:141`, validates against
`upsertPlaybackInputSchema` (`packages/contracts/src/index.ts:619`), and already does the
`canSeeTitle` visibility check. What is missing is the **read** path — nothing anywhere queries
that table.

`media_files`, `media_tracks`, `jellyfin_servers` and `jellyfin_items` genuinely have zero
references outside `schema.ts` and `schema.integration.test.ts` — treat those four as unproven
scaffolding.

- [ ] Add the missing `GET` (`/api/v1/me/playback/:installmentId`, and a list form for a "continue
      watching" row), visibility-checked the same way the `PUT` already is.
- [ ] Extend `upsertPlaybackInputSchema` with `subtitleOffsetMs`; regenerate the client. Reuse the
      existing endpoint — do not introduce a second, differently-shaped playback route.
- [ ] Restore position on open; persist on pause, exit, and a periodic interval (throttled — this
      is a DB write, not a telemetry stream).
- [ ] Surface resume in the UI ("متابعة من …").

### Subtitles

- [ ] OpenSubtitles integration — needs a free API key (ask when starting this phase) for their newer REST API (v1). Requires Api-Key and User-Agent headers; avoid the deprecated XML-RPC API.
- [ ] Match by `behaviorHints.videoHash` + `videoSize` when the addon supplies them (the accurate
      path); fall back to IMDb id + `filename`.
- [ ] Download to a temp path and `sub-add` it.
- [ ] Offset control bound to mpv's **`sub-delay`** property — +/- buttons and a typed seconds
      field, applied live.
- [ ] Persist per installment via `subtitle_offset_ms`.
- [ ] Respect `subtitleMode: "off"`.
- [ ] Styling controls via `sub-font-size`, `sub-pos`.

### Tracks

- [ ] Enumerate embedded audio/subtitle tracks from `track-list`.
- [ ] Pickers writing `aid`/`sid`, gated on `canSwitchTracks`, constrained by `allowedAudio`.

---

# Phase 3 — Download-to-local

**Status:** Not started
**Done when:** a downloaded film plays from disk with no network, and shows as available offline.

- [ ] "Download" switches that torrent from streaming to a full download (all pieces, all files if
      wanted).
- [ ] On completion, move into a managed media folder.
- [ ] Insert a `media_files` row (`origin: "torrent"`, `torrent_info_hash`) — **and build the read
      path**, since nothing reads that table today.
- [ ] Resolver prefers the local file; mpv opens the path directly instead of over HTTP.
- [ ] "متاح دون اتصال" badge in the library.
- [ ] Downloads screen: pause, resume, remove, disk usage, configurable disk budget.
- [ ] Dedupe by `torrent_info_hash`.
- [ ] Resume partial downloads across app restarts — `SessionOptions { fastresume: true,
    persistence: Some(SessionPersistenceConfig::…) }`, already set in Phase 1.4 if that step was
      followed.
- [ ] Promotion path: a download started from an active stream must **reuse** the running torrent
      (switch `only_files` to all files via `api_torrent_action_update_only_files`), not restart it
      from zero.
- [ ] Document the per-OS download location, and make it configurable — a family archive is exactly
      the case where the media lives on a second drive.

---

# Phase 4 — Picture-in-picture + Chromecast

**Status:** Not started
**Done when:** PiP toggles without interrupting playback, and a film can be cast to a TV on the LAN.

Because the video is a native surface inside our own window, PiP is a window-state change on the
**existing** window — nothing restarts and no buffer is lost.

- [ ] PiP toggle: `setAlwaysOnTop(true)`, `setDecorations(false)`, `setSize`, plus a compact React
      control set. Add the matching capability entries (`core:window:allow-set-always-on-top`, …).
- [ ] Remember PiP geometry; restore prior window geometry on exit — `tauri-plugin-window-state`
      does this, no hand-rolled persistence needed.
- [ ] Chromecast via `rust_cast`: mDNS discovery, device list, cast/stop.
- [ ] Bind the stream server beyond loopback for casting — opt-in, LAN-only, documented. The
      per-session path token from Phase 1.4 stops being a nicety here and becomes the only thing
      between the family's stream and the LAN.
- [ ] Casting needs a codec the Chromecast can actually decode; unlike mpv it will not play
      arbitrary HEVC/AV1. This is the one place the "never filter by codec" rule breaks — either
      filter candidates for cast targets or accept that some films cannot be cast.
- [ ] `.rpm` target (Fedora is a stated target; `tauri.conf.json` currently bundles
      `["appimage", "deb"]` only). The libmpv dependency declaration itself moved to Phase 1.

---

# Phase 5 — Jellyfin as a resolver

**Status:** Not started (not the primary source yet)

- [ ] Server config UI + credential storage.
- [ ] Adjust `jellyfin_servers`/`jellyfin_items` — unused scaffolding, expect changes.
- [ ] Match installments to Jellyfin items via `ProviderIds.Tmdb`/`.Imdb` against the new columns.
- [ ] Library sync job.
- [ ] Direct play via /Videos/{id}/stream — mpv takes it as a plain URL but requires the Jellyfin auth token (either appended as ?api_key=... or passed via mpv's http-header-fields=Authorization: MediaBrowser Token=...); HLS (/master.m3u8) when the server insists on transcoding.
- [ ] Report progress back to Jellyfin's session API.
- [ ] Resolver order becomes `local → jellyfin → torrent`.

---

# Phase 6 — Debrid

**Status:** Not started

Torrentio has debrid support built into its config: adding `realdebrid=KEY` (or `alldebrid=`,
`premiumize=`) to the config segment makes the addon return streams carrying a **direct `url`**
instead of an `infoHash`. If Phase 1.5 handles `url`-bearing streams as specified, most of this
phase is configuration rather than code.

- [ ] Settings UI for provider + key, with a connection test.
- [ ] Store the key in the OS keychain — `tauri-plugin-stronghold`, or the `keyring` crate for a
      plain Secret Service/Keychain/Credential-Manager entry. **Not** `tauri-plugin-store` (that is
      a plaintext JSON file), and never in Postgres.
- [ ] Inject the key into the addon config segment server-side.
- [ ] `DebridResolver` for the direct-API path (resolving an `infoHash` against the provider) as a
      fallback for sources that aren't the family addon.
- [ ] Chain becomes `local → jellyfin → debrid → torrent`.

---

# Phase 7 — Android

**Status:** Not started

Same Tauri project (`pnpm tauri android init`); one platform-specific playback backend behind the
existing resolver boundary. Android's WebView is Chromium-based, and the platform-native player is
**androidx.media3 (ExoPlayer)** — with native Activity-level picture-in-picture.
[`tauri-plugin-videoplayer`](https://github.com/yeonv/tauri-plugin-videoplayer) is a working
reference for the Activity/Surface wiring.

- [ ] `pnpm tauri android init`.
- [ ] Android playback plugin backed by androidx.media3.
- [ ] Share the resolver, catalog, subtitle-fetch and playback-state code with desktop; swap only
      the engine.
- [ ] Native `enterPictureInPictureMode`.
- [ ] Decide the torrent story on mobile: rqbit cross-compiled, or debrid/Jellyfin only.
- [ ] Touch-first, RTL-correct control layout.

---

# Deferred

- TV/episode playback (`/stream/series/tt…:{season}:{episode}.json`) and id columns on `episodes`.
  Note the catalog is **184 seasons to 110 movies** — TV is the larger half of the archive, so this
  is deferred by sequencing, not by importance. Expect it immediately after Phase 2.
- Multiple subtitle languages — Arabic subtitles are the obvious follow-up.
- Source/quality picker UI beyond auto-pick-best (the API already returns the ranked list from
  Phase 1.5, so this is UI only).
- `kitsu_id` for anime that Torrentio only resolves by Kitsu id — sized by the Phase 0.5 report.
- Renaming `external_identities` → `reference_links`.
- Wayland-native rendering (X11 is forced today; add a subsurface renderer if that changes).

---

# Open questions — answer before starting the phase that depends on them

| Question                                                                                                                                                                                                                  | Blocks    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| Does the family addon accept `tmdb:` ids, or IMDb only?                                                                                                                                                                   | Phase 0.5 |
| What confidence threshold separates "auto-accept" from "human confirms"? (Cheap to be conservative — 110 items.)                                                                                                          | Phase 0.5 |
| Seeding: stop when playback ends, or keep seeding? Whose bandwidth question, not a technical one.                                                                                                                         | Phase 1.4 |
| Streaming cache size cap, and where it lives (system disk vs. media drive).                                                                                                                                               | Phase 1.4 |
| OpenSubtitles API key — free tier, registered to which account?                                                                                                                                                           | Phase 2   |
| Is the play button gated on anything beyond title visibility (per-account age/risk classification already in `packages/domain`)? A family archive with classification levels probably wants playback to respect them too. | Phase 1.6 |
