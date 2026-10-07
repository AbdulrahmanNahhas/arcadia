# Nahhasio — server-first rewrite

**2026-10-07 update:** [phases.md](./phases.md) now controls execution and review stops.
Aqua prioritized the local website and requested Tauri removal immediately. Tauri runtime/tooling
are removed; the former website and deployment are frozen under `reference/`. This document
preserves the initial architecture analysis and its original proposed order.

Decision record and implementation plan, 2026-10-07. Branch: `codex/nahhasio-server-first`.
The Git repository remains Arcadia for now. Nahhasio is the new product name.
The old v0.3.5 plan in Git history documents the previous direction; its remaining phases
are not automatic requirements for this rewrite.

## Product direction

Nahhasio is a private family media hub, initially available on the home network only.

- The server owns the curated catalog, artwork, editorial scores, family classifications,
  identities, permissions, and synchronized playback state.
- The website is the library reference site and administration dashboard. It keeps browsing,
  search, comparisons, people, studios, awards, and analysis. Playback belongs to clients.
- Kotlin/Compose clients browse, play, download to their device, and retain saved-work packs.
  Linux is first; Android and Android TV follow after the Linux playback experiment succeeds.
- A saved work contains metadata and optionally artwork, torrent metainfo, stable file mapping,
  source candidates, and subtitle files. It does not imply downloaded video. Saved sources can
  stream without the home server only while the sources/swarm remain available.
- Clicking **Download to home library** on the website creates a durable server download job.
  A completed, verified file is imported into the home library and becomes available in Jellyfin.

## Confirmed decisions and recommendations

Aqua prefers Rust for the new server and wants all first-party code in one repository.
Running real Jellyfin alongside Nahhasio is the recommended starting integration, selected
to meet the website-download-to-library use case. Implementing a Jellyfin-compatible API is
deferred; it is a separate compatibility project, not needed for that workflow.

| Part                      | Target                                                             | Reason                                                                        |
| ------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| Server                    | Rust, Axum, Tokio, SQLx/PostgreSQL                                 | Explicit SQL, typed boundaries, shared Rust media code                        |
| Database                  | Existing PostgreSQL catalog                                        | Preserve data, identifiers, relationships, and migration history              |
| Website                   | React, Vite, TanStack Router/Query, shadcn, Tailwind               | Keep useful forms and reference features; remove desktop responsibilities     |
| Media core                | Rust crate extracted from the existing librqbit/gateway code       | Reuse tested transfer/range behavior without Tauri dependencies               |
| Linux client              | Kotlin, Compose Multiplatform, Ktor, local SQL database            | Dedicated client UI and explicit local/offline state                          |
| Linux playback experiment | External mpv controlled through local JSON IPC                     | Prove decoding, seeking, subtitles, and progress before embedded-surface work |
| Rust/Kotlin bridge        | UniFFI, introduced in a small experiment                           | Keep media transport in Rust; prove packaging and cancellation on Linux       |
| Library playback          | Real Jellyfin, separate container                                  | Existing clients, file scanning, playback negotiation, transcoding            |
| Fedora deployment         | Rootless Podman Quadlet, persistent storage, LAN HTTPS entry point | Fits the home server; keeps operating-system changes small                    |

These are technology choices, not pinned dependency versions. Select and lock supported stable
versions when each component is introduced. Desktop Compose uses the JVM; Kotlin does not
automatically solve the native video-surface or GPU integration problem.

## Service boundaries

```text
Browser ── LAN web entry point ── Nahhasio Rust API ── existing PostgreSQL
                                         │
                                         └── durable jobs ── Rust media worker
                                                               │
                                                       download staging
                                                               │ verified import
                                                       home library files
                                                               │ read-only mount
                                                            Jellyfin

Kotlin client ── Nahhasio API: catalog / sources / auth / sync
      │
      ├── local saved-work database + progress outbox
      └── Rust torrent core ── loopback HTTP gateway ── platform player
```

The API and worker can share one Rust workspace and binary with separate `serve`/`worker`
commands. Heavy probing/remuxing runs in supervised subprocesses. Jellyfin retains its own
configuration/database; the Arcadia PostgreSQL catalog remains Nahhasio's source of truth.
One repository does not require one container or process.

Start with the current web container/proxy arrangement. Embedding the built SPA in the Rust
binary is an optional packaging step after server and dashboard behavior is verified.

## Preserve the data first

- Keep the database name `arcadia`, all existing UUIDs, auth-user/account links, progress,
  notes, scores, relationships, artwork paths, and the existing migration ledger.
- Back up PostgreSQL and the actual artwork directory; Git does not hold the full live state.
  Maintain a tested restore and an additional copy outside this laptop before a live cutover.
- Develop mutations on a restored disposable database. The initial Rust connection should use
  a restricted database role and read existing tables without migrations.
- Use additive migrations: new tables/nullable fields, explicit backfills, compatibility checks,
  then a separate decision about retiring old fields. Never regenerate the catalog from a seed.
- `packages/database/drizzle/` remains the only migration history during the transition. SQLx
  is the Rust data-access layer; do not create an independent SQLx migration tree. If migration
  ownership changes later, preserve the existing ledger/history through a deliberate handover.
- Compare all-table counts and row-content fingerprints on restored snapshots; counts alone
  cannot prove that notes, links, and identifiers survived. Also verify foreign keys and media.
- Plan rollback per release: backup restoration loses later writes, so prefer backward-compatible
  schema changes and identify a write-free cutover window where needed.

## Authentication and schema work

The current implementation uses Better Auth with separate `auth_*` tables and catalog `accounts`.
Existing code uses scrypt password hashing. The Rust migration must prove compatibility using
known-password fixtures and the exact installed implementation; never convert stored hashes
without a successful password verification. Session cutover may require signing in again, but
must preserve user identities and catalog ownership.

Separate these concepts in the target design:

- **User identity:** login credentials, recovery, owner/editor/member permissions.
- **Viewing profile:** progress and family content policy. Existing catalog accounts need an
  explicit mapping; adding profiles must not discard their saved state.
- **Device:** enrollment, revocable credentials, last sync, local/download capability.
- **Library:** storage location and access policy, independently of editorial classification.

Use same-origin cookie sessions for the website and revocable device credentials for clients.
Apply authorization to catalog reads, sources, jobs, sync, and artwork. Offline clients can
enforce the last saved policy, but immediate remote revocation cannot be guaranteed while offline.
Keep local development settings separate from LAN deployment; use working HTTPS/auth origins
instead of weakening cookie/session guards to make LAN login work.

The existing schema already has `background_jobs`, `editorial_revisions`, `media_files`,
`media_tracks`, `jellyfin_servers`, and `jellyfin_items`. Inspect their live use before expanding
or replacing them. New concepts likely include devices, profile links, saved-pack revisions,
persistent torrent/file mappings, source health, transfer leases/retries, and sync cursors.

For offline progress, record a unique event id, device id, local sequence, playback session,
position, and explicit watched/unwatched intent. Define conflict handling and idempotent retries.
The server reconciles events; simply taking the largest position or latest device timestamp
would break rewatching, seeking backward, and devices with inaccurate clocks.

## Download to home library

1. Select a work/episode and source, with quality/language information.
2. Authorize and enqueue an idempotent job with storage checks.
3. Download into staging with progress, cancellation, retry, and restart recovery.
4. Verify torrent data and the selected file; probe tracks and duration.
5. Import atomically into stable movie/series paths. Hardlink only when staging/library are on
   the same filesystem; otherwise use an explicit copy/move policy. Use shared SELinux labels
   for library mounts consumed by both the worker and Jellyfin.
6. Record the media-file mapping, request a Jellyfin scan, and link the resulting item id.
7. Show **Available in home library** only when import is complete; report a failed scan separately
   from a failed download. Reconcile after restarts instead of creating duplicate transfers.

Device download is a separate workflow. The first version can download the chosen torrent
file directly. Selecting an audio track does not remove its bytes from a multiplexed source.
Optional server remux/export needs source availability, temporary space, and a running server;
codec conversion is transcoding and has a separate cost. Do not make this a prerequisite for
basic device downloads or saved-source playback.

The local gateway must bind to loopback and handle range requests, cancellation, cleanup, and
opaque per-session access. A source change between different encodes needs a player reload and
time-based resume; arbitrary byte-range switching cannot be promised to work transparently.

## Admin dashboard priorities

Build around five clear areas rather than expanding the existing giant editor:

| Area                | First useful behavior                                                            |
| ------------------- | -------------------------------------------------------------------------------- |
| Overview            | Server health, storage, download queue, failed jobs, backup/restore status       |
| Catalog             | Fast search/filter, small editors, episode management, validation, artwork       |
| Sources and library | Source candidates, persistent file mapping, download/cancel/retry, import status |
| People and access   | Users, profiles, devices, capabilities, content/library policies                 |
| Operations          | Job history, logs, revisions/trash, backup and restore verification              |

Keep a schema-validated JSON editor as an advanced tool, with readable errors and a change
preview. Routine edits use focused forms. Use stable ids, transactions, optimistic concurrency,
and reversible trash/revisions before offering broad bulk-delete or merge actions. An audit log
by itself does not implement undo. Stream job status with SSE where useful; keep writes as
ordinary authenticated requests.

## Implementation order and exit checks

### 0. Baseline and recovery

- [x] Create the rewrite branch without renaming the Git repository.
- [x] Start the existing local PostgreSQL/API without Tauri; read live catalog counts.
- [x] Verify a database dump by restoring all application tables into a disposable database.
- [x] Preserve and verify the artwork archive; distinguish this from database-only recovery.
- [x] Confirm the existing website responds and unauthenticated catalog/admin requests return 401.
- [ ] Exercise signed-in owner/member behavior on a restored test database before Rust cutover.
- [ ] Inventory the Fedora server, storage, GPU, free space, and current data before deployment.

### 1. Rust server foundation

- [ ] Add `apps/server` to a Cargo workspace in the same repository; keep the old API available
      as a baseline. Initially use a separate local port, such as 23103.
- [ ] Implement configuration, tracing, health/readiness, SQLx connection pool, graceful shutdown,
      and bounded requests; no automatic catalog migration or seed.
- [ ] Define auth migration and prove existing credentials, identity links, and visibility rules.
- [ ] Implement authorized catalog list/detail and compare responses against restored fixtures.
- [ ] Establish one OpenAPI contract and generated web/Kotlin clients; avoid two independently
      evolving public schemas. Preserve current API compatibility during endpoint cutover.
- [ ] Produce a container and Fedora Quadlet recipe with pinned releases and explicit migrations.

**Exit:** the Rust server returns authorized catalog data from a preserved copy and can restart
cleanly in a container. The dashboard can move to its first Rust-backed read without data loss.

### 2. First dashboard slice and library download

- [ ] Port overview/catalog reads and one small transactional editor to Rust.
- [ ] Introduce the persistent download worker and storage/import mapping.
- [ ] Add download progress/cancel/retry and one real Jellyfin library integration.
- [ ] Exercise one chosen episode from website click through verified library import and playback.
- [ ] Repeat after worker/server restart; test duplicate click, disk exhaustion, and failed scan.

**Exit:** the website can request, observe, and recover a home-library download. The existing
catalog and administration remain usable through the staged transition.

### 3. Linux client experiment

Run this early, while dashboard work is still small, before retiring Tauri.

- [ ] Compose client login → browse → detail using the Rust API.
- [ ] Local file playback in external mpv, IPC progress, seek, subtitles, fullscreen, cleanup.
- [ ] Extract the shared Rust torrent core, package UniFFI bindings, and play one local-gateway stream.
- [ ] Test Wayland/XWayland, the actual GPU, RTL, HiDPI, memory, startup, buffering, and seek latency.
- [ ] Save a work/source pack; restart the client with the server off and test playback and queued sync.
- [ ] Decide whether an embedded video surface is necessary after measuring the working baseline.

**Exit:** measured Linux playback succeeds through both files and a torrent, including saved
sources with the server off. Compose/FFI packaging works outside the development shell.

### 4. Complete the migration and cleanup

- [ ] Finish auth/device/profile schema changes on restored copies and migrate remaining endpoints.
- [ ] Finish catalog editing, operations, reversible trash, revisions, and persistent sync.
- [ ] Test a Fedora LAN deployment and recovery from a fresh install with preserved data/artwork.
- [ ] Retire Hono, Tauri, desktop web routes, and the v1 compatibility adapter only after their
      replacements pass behavior/data checks. Remove dependencies with their final consumers.
- [ ] Introduce Android and Android TV after the Linux/data contracts are stable. Remote access,
      custom Jellyfin API compatibility, and iOS remain later projects.

## Evidence and references

Local baseline on 2026-10-07: 223 titles, 364 installments, 1,709 episodes, 330 people,
166 organizations, 141 awards, 11 planets, 828 media assets, and 3 catalog accounts.
PostgreSQL/API were verified ready; this is the existing Hono API, not a new Rust implementation.
The website responds at `http://127.0.0.1:23100/`; catalog and admin requests without a session
both returned 401. The API health endpoint returned 200 with database ready.

The private local backup is under `data/backups/nahhasio-baseline-20261007T103204Z/` (ignored by
Git): `arcadia.dump`, an artwork archive, per-table count/content fingerprints, and SHA-256
checksums. A temporary restore matched all 72 public/migration tables and was then removed.
All 828 registered artwork files exist and match their database SHA-256 hashes; comparing
the archived artwork against the source directory also passed. This is a verified local copy;
an independent backup remains a prerequisite for a live migration.

No migrations, seeds, catalog writes, package renames, or deletion of old runtime code were
performed while preparing this plan. One unused React import was removed after it blocked
the starting lint check. Runtime implementations otherwise remain unchanged.

Baseline verification:

- `pnpm build`: passed (all workspace builds; this does not produce a packaged desktop bundle).
- `pnpm --filter @arcadia/web test`: 22 files / 107 tests passed.
- `pnpm typecheck`: passed across the workspace.
- `pnpm check:rust`: formatting and Clippy passed.
- Oxlint passed after removing the unused import.
- `git diff --check`: passed.
- The combined `pnpm check` is not clean: the pnpm-provided Biome 2.5.7 executable cannot
  launch directly on this NixOS environment. The Nix-provided Biome 2.4.16 runs, but reports
  a configuration-version mismatch and 9 existing errors (empty local scheduled-task JSON,
  rendered-anchor accessibility reports, and an import-order issue). No broad lint/config
  rewrite was undertaken as part of this architecture review.

Primary documentation reviewed for the recommendations:

- [Compose/Kotlin supported-platform stability](https://kotlinlang.org/docs/multiplatform/supported-platforms.html)
- [Compose external-surface discussion](https://youtrack.jetbrains.com/issue/CMP-9571/Add-external-surface-APIs)
- [mpv JSON IPC](https://mpv.io/manual/stable/)
- [UniFFI user guide](https://mozilla.github.io/uniffi-rs/latest/)
- [Axum](https://docs.rs/axum/latest/axum/)
- [SQLx](https://docs.rs/sqlx/latest/sqlx/)
- [Jellyfin container/Podman installation](https://jellyfin.org/docs/general/installation/container/)
- [Android TV playback](https://developer.android.com/training/tv/playback)
