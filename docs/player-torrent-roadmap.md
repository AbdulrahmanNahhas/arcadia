# Local Player & Torrent Streaming — Guide & Roadmap

> **Status:** Phase 0 done (2026-08-25) · Phase 0.5 done (2026-08-25) · **Phase 1 playing
> end-to-end on Linux/Niri (2026-08-26)** — a film streams from the addon and renders inside the
> app window with working controls; the 10-film acceptance sample and CI packaging are still open ·
> **Phase 2 closed out (2026-08-29)** — TV/anime episode playback, subtitles (search, download,
> embedded-track selection, offset), audio-track switching, and `subtitleOffsetMs` persistence, all
> pending a real manual end-to-end pass once an OpenSubtitles key and a real family Torrentio addon
> are available · Next up: Phase 3 (download-to-local), or the Phase 1 acceptance run/CI packaging
> if that is still open · Last revised 2026-08-29
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

- [x] `tauri` → **2.11.5**, `tauri-build` → matching 2.6.x.
- [x] `librqbit = "9"` (latest **9.0.1**), `libmpv2 = "6"` (latest **6.0.0**) — both need a modern
      toolchain; `rust-version = "1.77.2"` will not build them.
- [x] `edition = "2024"`, `rust-version = "1.85"`. The existing
      `unsafe { std::env::set_var("GDK_BACKEND", "x11") }` in `main.rs` is already written in the
      2024-compatible form, so the edition bump is mechanical.
- [x] Add a release profile — absent today, and the difference is large for a binary that now
      contains ffmpeg-adjacent bindings and a BitTorrent stack:

  ```toml
  [profile.release]
  opt-level = 3
  lto = "thin"
  codegen-units = 1
  panic = "abort"
  strip = true
  ```

- [x] Add `cargo clippy -- -D warnings` and `cargo fmt --check` to the pre-handoff routine —
      landed as `pnpm check:rust`, chained onto the end of `pnpm check`.

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
- [x] Phase 2: `account_playback_states.subtitle_offset_ms` (nullable int) — done, migration
      `0021_white_rhino`. Also added `episodes.summary` (not originally listed here) in the same
      migration, same pattern as `installments.summary`.
- [ ] Phase 3: `media_files.origin` (`'import' | 'torrent'`) + `media_files.torrent_info_hash`.
- [ ] Phase 6: none — debrid keys belong in Tauri secure storage, not Postgres.
- [x] Resolved by Phase 2: TV playback is built, and `episodes` still gets no id columns — season
      stream/subtitle resolution goes through the **title's** `imdb_id`/`tmdb_id` plus the
      season's Stremio season number and the episode's `number`. That season number turned out to
      need its own computation rather than reusing `position` verbatim — see the correction in
      the Phase 2 section above.
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

**Status:** Done (2026-08-25) — via manual entry, not the automated matching pipeline below.
**Done when:** a coverage report shows **≥ 95 % of the 110 movie installments carry a validated
`imdb_id`**. ✅ **100 % (92/92) of released movie installments now carry `imdb_id`** — the admin
filled in most by hand through the Phase 0 editor form, and the remaining 27 (almost entirely the
anime-film residue this phase's design doc anticipated: every Studio Ghibli film, the Demon
Slayer/Jujutsu Kaisen/Haikyuu/SPY×FAMILY movie entries, Your Name, Weathering With You, Suzume)
were closed in one pass — each id looked up and web-verified individually (title + year cross-
checked against the actual IMDb page), then written directly. The remaining 11 installments
without an `imdb_id` are all `announced`/unreleased (no release date, or dated after 2026-08-25) —
correctly absent, not a gap.

**The automated matching pipeline below was deliberately skipped.** With the catalog this size
(110 movies) and most of it already hand-entered, building fuzzy-search-plus-scoring machinery,
confidence tracking, and a review UI for the remaining ~27 titles cost more than just looking each
one up — so that's what happened instead. If the catalog grows enough that manual entry stops
scaling, the design below is still the right shape for a real bulk backfill; nothing here forecloses
building it later.

**Found and fixed along the way (unrelated to backfilling missing ids, but same territory):** one
installment already had an `imdb_id` — Ice Age: Continental Drift was carrying `tt1646971`, which
is actually *How to Train Your Dragon 2*'s id, not its own (`tt1667889`). Caught by the new unique
constraint erroring on the actual backfill write, exactly the "duplicate id now errors instead of
silently no-op'ing" behavior Phase 0 added. Fixed as part of this pass.

### Matching pipeline

**Not built — see above.** Left as design reference for if/when the catalog outgrows manual entry.

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
- [x] `integrations/tmdb.ts` no longer takes `results[0]` blindly when a known id is available —
      the known-id fast path landed in Phase 0's follow-up work (artwork search), which happens to
      cover this item's underlying concern even though the bulk pipeline itself wasn't built.

### Review and reporting

Not built — no automated matcher means nothing to review/report on. If the bulk pipeline gets
built later, this section's design (confidence buckets, low-confidence review queue, an explicit
"unresolvable" marker, conflict surfacing) still stands.

### Verification

- [x] Hand-checked, not sampled — every one of the 27 backfilled ids was individually looked up and
      cross-referenced (title + year) against its real IMDb page, not machine-matched, so there's no
      "90% right, 10% silently wrong" risk to sample against.
- [ ] Addon fixture (`curl` per id form — `tt…` vs `tmdb:…` — against the family's Torrentio
      deployment): **still open**, needs the family addon's actual URL/config, which isn't
      available in this environment. Do this first thing when Phase 1 starts — it decides whether
      `tmdb:` ids are ever useful as a fallback or whether IMDb is the only real route.

---

# Phase 1 — Play a movie, end to end

**Status:** Code complete (2026-08-25); **acceptance run still outstanding.** Everything below is
built, compiles, and is covered by unit/integration tests, but no film has been played on a real
machine yet — the video surface, hardware decode and the whole time-to-first-frame budget are
unverified in the only way that counts.

**Done when:** **10 movies picked at random from the catalog** (not hand-chosen) each open from
`تشغيل الفيلم`, reach first frame inside the Performance-targets budget, seek correctly, report an
active hardware decoder, and tear the torrent session down cleanly on close — and the ones that
_cannot_ play fail with a specific, honest message (no id / no streams / no peers), never a spinner
that never resolves. A single demo film playing is **not** this phase.

### What bringing this up on a real machine actually cost

Five bugs stood between "compiles" and "a film plays", none of which any amount of desk-checking
would have found. They are recorded because each one is a trap the next platform will re-set.

1. **`gtk::Overlay` re-parenting aborts the app.** `tauri-runtime-wry` attaches an
   undecorated-resize handler to *every* Linux window-content webview — unconditionally; its
   `is_decorated()` check happens inside the handler, too late — and that handler does
   `webview.parent().and_then(|w| w.parent()).downcast::<gtk::Window>().unwrap()`. It hard-codes
   "the webview's grandparent is the toplevel". Any container inserted above the webview makes
   that `unwrap` fail inside a GTK signal trampoline, a C frame that cannot unwind, so the panic
   becomes `abort` on the first left click. **The widget tree must be left exactly as Tauri built
   it**; the video surface is a sibling `GdkWindow`, not a widget.
2. **libmpv refuses to start under a non-C `LC_NUMERIC`.** `mpv_create()` prints "Non-C locale
   detected" and returns NULL, which libmpv2 reports as the bare `Error::Null` — the literal
   "Null" that reached the family on screen. Fixed with `setlocale(LC_NUMERIC, "C")`; two tests
   pin it.
3. **GTK3 child windows are not X11 windows.** `gdk_window_new()` with `GDK_WINDOW_CHILD` creates
   a *client-side* window, and `gdk_x11_window_get_xid()` then returns the nearest native
   ancestor's id. mpv was handed the toplevel's id, could not embed, and opened its own window.
   `gdk_window_ensure_native()` is mandatory.
4. **`GDK_BACKEND=x11` does not steer libmpv.** With `WAYLAND_DISPLAY` set, mpv's `gpu-next`
   probes `waylandvk` first — a context in which `wid` is meaningless, because embedding into a
   foreign window is an X11 concept Wayland has no equivalent for. `main.rs` now removes
   `WAYLAND_DISPLAY` as well, after which mpv falls through to `x11vk`. Verified directly:
   `mpv -v` picks `waylandvk` with the variable set and `x11vk` without it.
5. **X11 does not alpha-blend sibling windows.** Video below a transparent webview is invisible
   (the webview paints alpha-0 over it and the desktop shows through while audio plays); video
   above an opaque webview hides the controls. Neither ordering gives controls over a picture.
   The surface is therefore stacked on top and **shaped** — its region is the window minus the
   rectangles the interface occupies, measured live from the DOM, so the webview shows through
   the holes and the picture is never cropped or resized.

### Acceptance run — what is left

- [x] **1.2 checkpoint:** a film renders inside the window with the React overlay on top, on
      Niri/Wayland via XWayland.
- [ ] Confirm `hwdec-current` reports a real decoder on this machine. The plumbing is in (a
      software fallback logs a warning and raises a "بالمعالج" chip in the bar); what has not been
      done is *reading* it on a machine with a known GPU.
- [ ] **1.4 checkpoint:** the Sintel/Big Buck Bunny magnet as a checked-in fixture; seek mid-file;
      confirm killing the window mid-stream leaves no orphaned session and no growing cache dir.
- [ ] **The 10-film sample** picked at random, with first-frame times recorded rather than
      estimated. This is the actual bar for calling Phase 1 done.
- [ ] **Addon fixture** (`tt…` vs `tmdb:…`) recorded from the family deployment, so
      `ARCADIA_STREAM_ALLOW_TMDB_IDS` can be settled. Note the public `torrentio.strem.fun`
      Cloudflare-blocks VPN egress ranges outright — a 403 on every path, for browsers too — which
      is worth knowing before blaming the code.
- [ ] **Packaging:** `.github/workflows/release.yml` (superseding the earlier hand-rolled
      `tauri-build.yml` — see `docs/deployment-and-release-roadmap.md` §5) builds, signs, and
      publishes AppImage/deb/rpm artifacts plus the updater's `latest.json` from a standard-distro
      (`ubuntu-latest`) runner on a pushed `v*` tag, closing the "no CI workflow exists yet" half
      of this item. `.github/workflows/ci.yml` also runs `pnpm check:rust` on every push/PR.
      **Still open:** a GitHub-hosted runner has no display or GPU, so nothing yet confirms the
      built artifact actually plays a file — that half stays a manual step on real hardware (see
      the acceptance run above), and no tag has actually been pushed through this workflow yet
      (needs the one-time signing-key/`ARCADIA_API_URL` setup in README's "Releases and updates").

### Known limits of the current compositing approach

The shaped-surface technique works and is cheap, but cut-outs are **rectangular and hard-edged**.
That rules out rounded corners on the bar, `backdrop-filter` blur behind it, and any fade between
chrome and picture — all of those need per-pixel blending.

The fix is mpv's **GL render API** drawing into a GTK `GLArea`, so the video joins the normal draw
cycle and the webview composites over it like any other layer. It is blocked on trap #1 above: the
`GLArea` has to sit above the webview, which is exactly what makes Tauri's handler abort. Options,
in order of preference:

- Upstream a fix to `tauri-runtime-wry` so the handler walks to the toplevel instead of assuming a
  depth of two, then use `gtk::Overlay` normally.
- Disconnect that one signal handler on the webview after Tauri installs it.
- Keep the shaped surface and design the bar to suit it (solid fills, square edges).

### 1.1 Environment

- [x] `devenv.nix`: `mpv`, `libGL`, `libva`, `libvdpau` (`pkg-config` was already there).
      `pkgs.mpv` alone provides `mpv.pc` — no separate `libmpv` attribute is needed; verified with
      `pkg-config --modversion mpv` → `2.5.0`.
- [x] GStreamer — **not for the player** (mpv uses ffmpeg internally) but for the webview's YouTube
      trailer iframe, plus `GST_PLUGIN_SYSTEM_PATH_1_0`, since devenv's plain `packages` list does
      not run the module-registration setup hooks.
- [x] Fedora runtime requirement documented in README ("Playback runtime").

### 1.2 mpv renders a local file inside the Tauri window

- [x] `libmpv2 = "6"` plus the edition/toolchain/profile changes, in one commit.
- [x] `src-tauri/src/player/mod.rs`: `MpvEngine` owning the libmpv handle, with its event loop on a
      dedicated OS thread (`wait_event` blocks; a tokio worker held for the length of a film would
      starve the runtime).
- [x] Init options: `vo=gpu-next`, `hwdec=auto-safe`, `gpu-api=auto`, `keep-open=yes`, `osc=no`,
      `input-default-bindings=no`, `input-vo-keyboard=no`.
- [x] Cache/decode options set at init, not discovered later: `cache`, `demuxer-max-bytes` (256
      MiB), `demuxer-max-back-bytes` (128 MiB), `demuxer-readahead-secs` (60), `cache-pause` +
      `cache-pause-wait`, `hr-seek`, `vd-lavc-dr`, `interpolation=no`, `network-timeout`.
- [x] **Linux windowing:** `GDK_BACKEND=x11` kept, giving libmpv a stable X11 `wid` on every
      compositor via XWayland.
- [x] **Composition via `gtk::Overlay`** (`player/surface.rs`): a `gtk::DrawingArea` becomes the
      base child and Tauri's webview is re-parented on top as the overlay child. Written; **not
      yet seen on screen.**
- [x] **Webview transparency:** `"transparent": true` on the window, plus a
      `body.arcadia-player-open { background: transparent }` class the player route adds while
      mounted, so the rest of the app stays opaque.
- [x] Fullscreen toggle through Tauri's window API, and mouse-inactivity auto-hide (2.5 s).
- [x] Video surface kept in sync with window resize, through `connect_size_allocate` on the
      toplevel — there is no `gtk::Overlay` to do it for free (see trap #1).
- [x] `hwdec-current` (not `hwdec`) is read back after `FileLoaded`; software decode logs a warning
      and raises a badge in the UI rather than passing silently.

### 1.3 mpv control surface

- [x] Commands: `player_load` (via `player_start_stream`), `player_play`, `player_pause`,
      `player_seek`, `player_set_volume`, `player_set_property`, `player_get_property`,
      `player_stop`, plus `player_init` and `player_subscribe`.
- [x] Observed and pushed over a **`tauri::ipc::Channel`**, never polled: `time-pos`, `duration`,
      `pause`, `paused-for-cache`, `demuxer-cache-duration`, `eof-reached`, `idle-active`.
      `time-pos` is throttled to 4 Hz **in Rust**.
      Note: only *scalar* properties are observed. libmpv2's `PropertyData` hits `unimplemented!()`
      on node-typed properties, so observing `demuxer-cache-state` or `track-list` would panic —
      the scalar equivalents carry everything Phase 1 needs. Phase 2 must read `track-list`
      on demand rather than observing it. **Confirmed and done in Phase 2**: `track-list` is
      individually-indexed scalar sub-properties (`track-list/count`, then `/N/id`, `/type`,
      `/lang`, `/title`, `/selected` per index), every one reachable through the existing
      `player_get_property` — no new Rust needed, see `listPlayerTracks()` in `desktop-player.ts`.
- [x] Coalesced into one `PlayerEvent` enum — one IPC hop per tick, not eight.
- [x] Registered via `generate_handler!`; no capability entries needed for them. Only
      `core:window:allow-set-fullscreen` / `allow-is-fullscreen` were added to
      `capabilities/default.json`.

### 1.4 Torrent engine

- [x] `librqbit = "9"`, no separate tokio runtime — `tauri::async_runtime` throughout.
- [x] Long-lived `Session` built once in `setup`, storage under `app_cache_dir()/streams`
      (disposable; Phase 3's kept downloads will use `app_data_dir()`).
- [x] `SessionOptions`: `fastresume: true`, `persistence: Some(SessionPersistenceConfig::Json{..})`
      so Phase 3's restart-resume is config rather than a rewrite, and `peer_limit: 64`.
- [x] `start_stream` builds the magnet (**with every `tr=`**), adds the torrent with
      `only_files: [file_idx]`, and returns the local stream URL.
- [x] Served over a small axum route backed by `ManagedTorrent::stream(file_idx)`, honouring
      `Range` — including the unsatisfiable-vs-malformed distinction, which is unit-tested.
- [x] **Stream server secured:** bound to port 0 (ephemeral) with a per-session 32-char random
      token in the path. librqbit's own HTTP API — which includes torrent *control* endpoints — is
      not mounted.
- [x] Magnet→metadata resolution is an explicit `resolving` state with a 30 s timeout that fails
      over rather than hanging.
- [x] **Candidate failover:** metadata timeout, no peer within 20 s, or zero throughput moves to
      the next ranked candidate, and the UI is told which attempt it is on
      (`PlayerEvent::Attempt`). Only an exhausted list is a failure.
- [x] `stream_status` → progress, peers, download rate, pushed over the Channel at 4 Hz.
- [x] `stop_stream`; all streams stopped on `CloseRequested`, `ExitRequested`, and `Drop`.
- [x] **Disk policy decided:** `stop_stream` deletes the torrent's data (`delete_files: true`)
      unless it was promoted to a download, and the cache dir is LRU-pruned to a 20 GB budget on
      startup. Both constants live at the top of `src-tauri/src/torrent/mod.rs`.
- [x] **Seeding posture — decided (2026-08-31): uploading is disabled.** `librqbit`'s
      `disable-upload` cargo feature is enabled and `SessionOptions.disable_upload = true`
      (`DISABLE_UPLOAD` constant, top of `src-tauri/src/torrent/mod.rs`). Streamed data is deleted
      the moment playback stops, so there is nothing left to seed from afterward anyway; no
      user-facing setting was added since there is no real trade-off to expose. Flip the constant
      if that reasoning changes.

### 1.5 API — stream discovery

- [x] `GET /api/v1/installments/:id/streams`, resolving the id as `installments.imdb_id` →
      `installments.tmdb_id` (flag-gated) → the same two on `titles` **only when the title holds
      exactly one film**, since otherwise the title's id names a different work.
- [x] Visibility re-checked via `visibleTitleIdsForAccount` — which applies the whole policy
      (audience/age/risk classification and per-account blocks), not just the private flag. That
      answers the open question below: playback inherits exactly the rules browsing has.
- [x] Every failure has its own code: `not_found` (404), `not_permitted` (403), `no_identifier`
      (409), `unsupported_kind` (400, seasons), `source_unavailable` (502),
      `source_not_configured` (503). An addon that answers with nothing is a 200 with an empty
      list — deliberately distinct from an addon that failed.
- [x] `integrations/torrent-source.ts`: base URL **and** config segment from env, best-effort
      failure, never throws. `null` means "did not answer"; `[]` means "answered, has nothing".
- [x] `sources` parsed into a clean tracker list; `dht:` entries dropped.
- [x] `description ?? title`; quality/seeders/size/indexer parsed out of the emoji-annotated text.
- [x] Ranked English → resolution → seeders → size, with two guards in front: a `direct` (debrid)
      source beats every torrent, and a zero-seeder source sinks to the bottom whatever its
      resolution. **No codec filtering.** Resolution is ranked against
      `ARCADIA_STREAM_PREFERRED_HEIGHT` (default 1080) rather than "highest wins" — a 40 GB 4K
      remux cannot meet the 15 s first-frame budget, so naive descending would have quietly broken
      the stated target.
- [x] Parser unit-tested against a captured fixture including **missing `sources`, missing
      `fileIdx`, a malformed size string, a mixed-case infoHash, a `description`-only stream, a
      zero-seeder stream and an unplayable one**. The whole wire shape is parsed by a Zod schema
      whose every field carries `.catch()`, so one bad value degrades instead of dropping the
      response.
- [x] **All** viable candidates returned ranked, not just the winner — failover needs the list.
- [x] `AbortSignal.timeout` (~8 s) and a ~15 min in-process cache keyed by base URL + config + id.
- [x] Response schema in `packages/contracts/src/playback.ts`; client regenerated.
- [x] `url`-bearing (debrid) streams handled as first-class `direct` candidates, so Phase 6 is
      mostly configuration.
- [x] Under the authenticated `/api/v1/*` boundary; no audit row (it is a GET).

### 1.6 Web — player UI

- [x] `@tauri-apps/api` added.
- [x] **Every Tauri call guarded.** `@tauri-apps/api` is only ever reached through a dynamic
      `import()`, behind `isDesktopShell()`. In a browser the play button degrades to a disabled
      control explaining "متاح في تطبيق سطح المكتب", which also keeps the e2e suite green. The
      check goes through `useSyncExternalStore` with a `false` server snapshot, so there is no
      hydration mismatch in the prerendered shell.
- [x] `PlaybackResolver` (`features/library/playback-resolver.ts`), `local | jellyfin | torrent |
      debrid` in shape, `torrent`/`debrid` in behaviour.
- [x] Player route (`/player/$installmentId`), outside the platform shell, transparent background,
      RTL-correct controls: play/pause, scrubber with a buffered range, mute, fullscreen, keyboard
      shortcuts. **Scrubber position is a `ref` written inside `requestAnimationFrame`**, which
      extrapolates between the 4 Hz ticks so it moves at display rate while React commits nothing.
- [x] Buffering UI distinguishes *resolving metadata*, *trying candidate N of M*, *buffering*, and
      *stalled — no peers*.
- [x] Error states for every failure code, plus "all candidates dead" and "mpv failed to init".
- [x] `autoplay` honoured. `allowedAudio`/`canSwitchTracks` have nothing to gate yet — track
      switching is Phase 2 — so they are wired at the preference read, not the UI. **Phase 2**:
      now gate the real `AudioTrackMenu`/`SubtitleMenu` popovers in `player-controls.tsx`.
- [x] Placeholders wired: `تشغيل الفيلم` on the episodes tab, `ابدأ بالمشاهدة` in the hero (only
      when the title holds exactly one film; otherwise it still jumps to the episode list, since
      "start here" is meaningless for a franchise), the watch-radar tooltip reworded off Jellyfin,
      and the admin overview badge flipped to "التشغيل عبر التورنت جاهز".
- [x] Real CSP in `tauri.conf.json` (was `null`), allowing the loopback stream origin and the
      YouTube trailer iframe.
- [x] `"transparent": true` on the window. macOS would additionally need
      `app.macOSPrivateApi: true` — noted, not set, since macOS is not a target.
- [x] Stream torn down on route exit, window close, and app quit.
- [x] `.rpm` added to bundle targets and libmpv declared as a `deb`/`rpm` dependency. **Whether the
      bundle actually plays is still unverified** — see the acceptance run above.
- [x] Control bar reworked for the shaped surface: full-window chrome layer with the back button
      top-left and the transport bottom, `pointer-events-none` on the layer so clicks reach the
      picture and each control opts back in. Real logic behind speed (mpv `speed`), volume, mute
      and the ranked source list; slots with tooltips for subtitles, audio tracks, download, PiP
      and cast. Keyboard: `Space`/`k`, `←`/`→` (following the LTR timeline, not the RTL page),
      `↑`/`↓` for volume in 10 % steps, `f`, `m`, `Esc`.
- [x] The surface is hidden until the first frame and hidden again on route exit — `keep-open=yes`
      means mpv holds its last frame forever, which otherwise sits over whatever the app shows
      next.

# Phase 2 — Subtitles, tracks, resume, and TV/anime playback

**Status:** Closed out 2026-08-29.
**Done when:** an English or Arabic subtitle track can be found, downloaded and rendered, offset
adjusted live, both the offset and playback position are restored on reopening the film or
episode, embedded audio/subtitle tracks can be switched, and a TV/anime episode plays through the
same Torrentio pipeline movies already used.

mpv has libass built in, so subtitles are native — no WASM subtitle stack, no JS timing shim.

Resume-on-open and periodic progress persistence (the "Playback state API" work originally
scoped here) landed **before** this phase, in the user's own self-directed watch-tracking work
(commits `4e6dd11`…`51a023a`): `account_playback_states` has a full read+write API, the player
already resumes a saved position, and "My Space" (مساحتي) surfaces continue-watching rows. This
phase's playback-state work was therefore narrower than originally scoped: one additive column
(`subtitle_offset_ms`) plus threading it through the existing read/write endpoints, not a new API.

### TV/anime playback (pulled forward from Deferred)

Series installments now play through the exact `{titleImdbId}:{season}:{episode}` Stremio
convention movies already used, no addon-layer changes needed — Torrentio's `/stream/series/…`
response is the identical JSON shape `parseStreams`/`rankCandidates` already handled.

- [x] `GET /api/v1/installments/{id}/streams` takes an optional `episodeId` query param; a season
      with no `episodeId` still 400s (`unsupported_kind`, message updated), a fractional episode
      number 409s (`no_identifier` — Torrentio has no slot for a half-numbered special), and
      resolution always goes through the **title's** `imdb_id`/`tmdb_id` (a season never carries
      its own, per Phase 0). **Correction after real-catalog testing**: `seasonNumber` is *not*
      `installment.position` — `position` is the whole title's installment ordering (seasons and
      movies interleaved), so a season after even one interspersed movie gets the wrong Stremio
      season number under that scheme (confirmed live: Solo Leveling season 2, `position=1`,
      played as season 1). `seasonNumber` is now the season's own 1-indexed rank among only its
      season-kind siblings (`1 + count of season-kind siblings with a lower position`), computed
      the same way in both the streams and subtitles routes.
- [x] `episodes.summary` column (additive migration `0021_white_rhino`), threaded through the read
      path (`repository.ts`), the admin structure-write route, the CLI's `work apply`/`work
      export`, and the admin JSON-projection editor. `episode.posterPath` also added to the read
      path — zero schema work, `media_asset_assignments.episode_id` was already there.
- [x] Player threads `episodeId` through the search schema, `player-page.tsx`, and
      `playback-resolver.ts`.
- [x] Real per-episode play button (`PlayEpisodeButton`/`unplayableEpisodeReason` in
      `play-button.tsx`) replacing the hardcoded-disabled `EpisodeCard` button; a season-level
      "continue from episode N" / "بدء المشاهدة" / "إعادة المشاهدة" CTA computed client-side from
      already-fetched playback data.
- [x] My Space's continue-watching cards deep-link into `/player/$installmentId` instead of the
      title page.

### Subtitles

- [x] `apps/api/src/integrations/opensubtitles.ts` — OpenSubtitles REST v1 (`Api-Key` +
      `User-Agent` headers, not the deprecated XML-RPC API), best-effort like `torrent-source.ts`:
      no `OPENSUBTITLES_API_KEY` behaves exactly like `source_not_configured`.
- [x] Matches by `moviehash` (the accurate path — the same hash `behaviorHints.videoHash` already
      carries) first, falls back to the title's IMDb id (or `parent_imdb_id` +
      `season_number`/`episode_number` for an episode).
- [x] `GET /api/v1/installments/{id}/subtitles` (search, ranked hash-match-first) and
      `GET .../subtitles/{fileId}/download` (a separate route, since OpenSubtitles' download link
      is a short-lived, quota-counted resource — only spent once a candidate is actually chosen).
- [x] New Tauri command `player_load_subtitle` + `MpvEngine::load_subtitle` running the `sub-add`
      *command* (not a property, so it couldn't ride the existing `set_property`) — takes bytes +
      a filename, writes to the app cache dir, then `sub-add`s the local path. The frontend
      downloads through the API's authenticated proxy first (never talks to OpenSubtitles
      directly), same reasoning as the addon URL staying server-side.
- [x] Offset control (+/- 100 ms buttons, live seconds readout) bound to `sub-delay` via the
      already-generic `setProperty` — no new Rust needed for this part.
- [x] Persisted via `subtitleOffsetMs` on `upsertPlaybackInputSchema`/`accountPlaybackStateSchema`
      (nullable `subtitle_offset_ms` column, additive migration) and restored through the same
      `getPlaybackForInstallment` call the position-resume already made.
- [x] The subtitle menu doesn't render at all when the account's `subtitleMode` is `"off"`.
- [ ] Styling controls (`sub-font-size`, `sub-pos`) — deferred, genuinely optional polish; would
      cost zero new Rust (same generic `setProperty` path) whenever it's picked up.

### Tracks

- [x] `listPlayerTracks()` in `desktop-player.ts` enumerates `track-list/count` then per-index
      `track-list/N/id`/`/type`/`/lang`/`/title`/`/selected` — every one a plain scalar property
      reachable through the existing generic `getProperty`, confirming the roadmap's original
      assumption (`track-list` itself is node-typed and can't ride `observe_property`) needed zero
      new Rust to work around.
- [x] Embedded subtitle tracks are picked from inside the same "الترجمات" popover as the
      OpenSubtitles search results (one menu, not two dead-feeling ends); embedded audio tracks
      get their own "المسار الصوتي" popover. Both write `sid`/`aid` via the existing generic
      `setProperty`.
- [x] Audio picker gated on `canSwitchTracks`, tracks outside `allowedAudio` shown but disabled.

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

**Catalog note (2026-08-29):** the user has decided the ~49 titles below — mostly older
dubbed/classic children's anime and a few long-runners — should be **Jellyfin-only**: no torrent
IMDb/TMDB id backfill effort should be spent on them, since they are expected to be served from
the family's own Jellyfin library once this phase lands, not resolved through Torrentio. Recorded
here rather than left only in chat so Phase 0.5-style backfill work and this phase both know to
skip them:

Aesop's Fables (`c8baa5ea-1710-4aec-b15d-5208ef40aae8`), Anne of Green Gables
(`24a409c2-998e-46a1-ba0a-c38a9a752339`), Arabian Nights: Sinbad's Adventures
(`f4b5a4c1-3bb6-409d-b6ef-c0391163c30b`), Babar (`b7649b4b-9def-43e9-a79b-e5b53c3483ac`), Baby &
Me (`d99623d7-3f2e-4b7d-9bc3-39a089486743`), Belle and Sebastian
(`314ab9e6-2d2c-4c0d-879b-1b29e08a0045`), Beyblade: Metal Fusion
(`de4fb734-4b66-485f-bf06-0c7d6fb0671d`), Captain Tsubasa (`096acab5-7489-453d-aec2-9e43a4545d50`),
Cocotama (`48488084-fb7f-40b9-8d2b-bb737963f17a`), Cookin' Idol Ai! Mai! Main!
(`cf4e83cb-6043-4f59-ad25-774b7cb0437b`), Detective Conan / Case Closed
(`4840dcee-ff6c-4928-a94e-8cd5df8ff8aa`), Don Chuck Story (`14118ae0-c3b9-4cde-bc03-756abf4729be`),
Doraemon (2005) (`7a488b30-ee91-40d1-997f-babdf90dc3e7`), Dragon Quest: The Adventure of Dai
(`434abafb-9780-43f9-bc91-045116331738`), Eon Kid / Iron Kid
(`95848c30-981b-4351-a191-a607fa2dab23`), Fairy Tales of the World
(`6ace250e-21e6-4eee-a74e-16ba3c39b558`), Future Boy Conan (`0410de35-536d-4906-a402-d977661dfa47`),
Grimm's Fairy Tale Classics (`710865f5-a426-4336-9d23-301245213dca`), Haikyuu!!
(`81099275-5496-4ac8-b0d7-e82b3d1aeeeb`), Hamtaro (`6375a3ff-94a5-4a84-84d8-50500d4df740`), Heidi,
Girl of the Alps (`9ceaf29f-e8bb-4bab-89b3-f992e505c87b`), Hello Anne: Before Green Gables
(`cec4fee8-134b-4412-9225-d6f352b8f6ab`), Inazuma Eleven (`1154237d-77be-4153-b195-f2156c8d4f4f`),
LBX: Little Battlers eXperience (`74fac49f-e90b-41c0-b655-2334b1d585b7`), Les Misérables: Shoujo
Cosette (`537cd6c8-3c4f-4cc0-85f6-123952b03a93`), Little Women II: Jo's Boys
(`76c0a584-9eee-438e-a3f7-f371467cacdf`), Lucy-May of the Southern Rainbow
(`eaf49135-ab76-44f4-abf8-e809d1690ca4`), Mama is a 4th Grader
(`95d1fb66-bc4c-42d0-903e-f76248d2b030`), Maya the Bee (`6eab6fe1-4a9b-4d0e-8d36-b887c4722ea7`),
Muka Muka Paradise (`9991f774-fe29-47a8-8449-3aebb67779c2`), Once Upon a Time... Life
(`915bce4c-2ae6-4664-bcd4-eee7867baaa6`), Pipero's Adventures
(`f0095a23-d6da-49e8-9485-e77bf6203555`), Princess Sara / Little Princess Sara
(`da40457e-a75e-4aff-8daf-49729cc26581`), Remi, Nobody's Girl
(`a61702f0-9e17-4642-9eb6-0a548a236664`), Robin Hood's Great Adventure
(`30ddb323-9c7b-4bcb-949d-e606a9304114`), Romance of the Three Kingdoms
(`a8d4cc64-2176-4781-83e1-6b697114f2b2`), Romeo and the Black Brothers
(`b36c5e34-807f-449a-a274-ccc7726e1744`), Sonic X (`7130871c-ca7e-4a45-baaf-bebfe2a49aba`), Tales
of Little Women (`76842f99-bf52-40a9-a4ee-dd5c1af64177`), The Adventures of Tom Sawyer
(`1f9f7e15-fdac-491a-8003-b6209b8a0d58`), The Marshmallow Times
(`4c266c72-8f87-4fc0-8363-16fe9fa6693f`), The Mysterious Cities of Gold
(`cc81178f-922e-4867-89b5-0da1107b320d`), The Secret Garden (`c1108174-490e-4b73-bf5d-0b2a75dd38cf`),
The Story of Pollyanna, Girl of Love (`703df859-8870-4fa8-aa7e-81b0db895add`), The Swiss Family
Robinson: Flone of the Mysterious Island (`12a766e3-88ac-4f8e-b77c-325f5365509d`), The World's Most
Famous Tales (`d0ba666a-c905-429e-b949-a5903e6132d2`), Trapp Family Story
(`40e5c35f-ccfc-4566-8763-5b17a33e7538`), Treasure Island (`260dbec8-8a08-4956-be18-0cb94569909a`),
UFO Robot Grendizer (`ab99a676-4502-49e5-8b33-028f2b3cfd71`).

Separately, three titles were named as the **catalog completeness standard** other titles should be
brought up to — full episode data (numbers, titles, summaries, release dates, posters), current
schema: Vinland Saga (`e9c0fa70-c75f-416f-abf6-86460ea2cc0f`), Solo Leveling
(`73d03ddb-9243-4ca4-8df7-567f2d7e49bf`), and Fullmetal Alchemist: Brotherhood
(`be753361-5f10-4dd2-b5b3-b843c2eb5405`). Filling these three out, and improving the admin
dashboard's episode editing UI to match the current schema (`summary`, `posterPath` per episode —
see this Phase 2 section above), is tracked as follow-up work, not yet started. A TMDB-backed
auto-fetch tool for episode titles/summaries was discussed as a possible later addition (TMDB's
`/tv/{id}/season/{n}` endpoint returns per-episode name+overview for a free API key) but is
explicitly out of scope for this pass — see Phase 2 §3's note above on why: the rest of the catalog
is hand-curated, and a sync tool is a real feature of its own.

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

- Subtitle styling controls (`sub-font-size`, `sub-pos`) — Phase 2 shipped everything else in its
  Subtitles section; this one small UI addition (no new Rust) was left for later.
- Multiple subtitle languages beyond the `ar,en` default `installments/{id}/subtitles` already
  searches — a `languages` query param already exists, this is UI-only follow-up (a picker for it).
- Source/quality picker UI beyond auto-pick-best (the API already returns the ranked list from
  Phase 1.5, so this is UI only).
- `kitsu_id` for anime that Torrentio only resolves by Kitsu id — sized by the Phase 0.5 report.
- Renaming `external_identities` → `reference_links`.
- Wayland-native rendering (X11 is forced today; add a subsurface renderer if that changes).

---

# Open questions — answer before starting the phase that depends on them

| Question | Blocks | Status |
| --- | --- | --- |
| Does the family addon accept `tmdb:` ids, or IMDb only? | Phase 0.5 / 1.5 | **Still open.** Needs one `curl` against the family deployment; until then `ARCADIA_STREAM_ALLOW_TMDB_IDS` defaults off and only IMDb ids are sent. Nothing is blocked — the catalog is at 100 % IMDb coverage for released films. |
| What confidence threshold separates "auto-accept" from "human confirms"? | Phase 0.5 | **Moot.** The bulk matcher was never built; every id was entered by hand. |
| Seeding: stop when playback ends, or keep seeding? | Phase 1.4 | **Still open, and now the last blocker in Phase 1 that is a decision rather than a task.** librqbit uploads while connected and nothing stops it. `disable-upload` is a cargo feature with a matching `SessionOptions` flag, so either answer is a few lines. |
| Streaming cache size cap, and where it lives. | Phase 1.4 | **Answered:** `app_cache_dir()/streams`, 20 GB, LRU-pruned on startup, and a stream's data is deleted when it stops unless promoted to a download. Constants at the top of `src-tauri/src/torrent/mod.rs` — change them there if 20 GB is wrong for the family's disk. |
| OpenSubtitles API key — free tier, registered to which account? | Phase 2 | **Still open** (not a blocker — the integration degrades to `source_not_configured` with no key, exactly like the addon URL). The code (`apps/api/src/integrations/opensubtitles.ts`) is done and tested against a stubbed response; what's missing is a real `OPENSUBTITLES_API_KEY` in the deployment's env and one real end-to-end download to confirm the REST v1 shape matches what was implemented from documentation. |
| Is the play button gated on anything beyond title visibility? | Phase 1.6 | **Answered: yes, and it already is.** The endpoint filters through `visibleTitleIdsForAccount`, which applies the full `VisibilityPolicy` — audience, age, the three risk levels, and per-account title/tag/genre/entity/planet blocks. Playback inherits exactly the rules browsing has, and the hidden play button is not what enforces it. |
