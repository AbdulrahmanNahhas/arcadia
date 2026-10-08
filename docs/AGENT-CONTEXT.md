# Nahhasio — current workspace map

Updated 2026-10-08. Read [phases.md](./phases.md) for the current milestone and review boundary.
The Git repository is still Arcadia; the product and new packages are named Nahhasio.

## Active code

| Path                                     | Responsibility                                                                              |
| ---------------------------------------- | ------------------------------------------------------------------------------------------- |
| `apps/server`                            | Rust/Axum/SQLx server: health and guarded local database administration                     |
| `apps/web`                               | Arabic-first TanStack Start/Vite dashboard, TanStack Router/Query, Base UI shadcn Nova      |
| `apps/web/src/app`                       | Router/query-client setup and route fallback                                                |
| `apps/web/src/routes`                    | Small file-based route entries and RTL app shell                                            |
| `apps/web/src/features`                  | Feature-owned server queries and UI                                                         |
| `apps/web/src/components/ui`             | Official shadcn primitives (including the official Sidebar); install/update through the CLI |
| `apps/web/src/styles.css`                | Theme tokens, self-hosted font subsets, reduced-motion behavior                             |
| `apps/web/tests`                         | Playwright journeys; no live database mutations                                             |
| `Cargo.toml` / `Cargo.lock`              | Rust workspace/dependency lock; Tauri removed                                               |
| `pnpm-workspace.yaml` / `pnpm-lock.yaml` | TypeScript workspace/dependency lock                                                        |
| `oxlint.config.ts`                       | Oxlint, generic anti-slop, and six shadcn rules for new website source                      |
| `.oxfmtrc.jsonc`                         | Oxfmt formatting/import sorting; excludes generated/vendor/historical code                  |

`apps/linux` is the Rust GTK4/libadwaita/WebKitGTK shell; `apps/linux/ui` is its independent
React/Vite/TypeScript viewing interface. Libmpv playback follows its own milestone.
Read `linux-client-plan.md` for scope and learning ownership. `packages/api-contract` owns
OpenAPI/generated TypeScript contracts; Kotlin output and Gradle were retired.
Do not create empty packages or copy desktop/player responsibilities into the dashboard.

## Transition code and data

| Path                                               | Status                                                                              |
| -------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `reference/arcadia-web`                            | Previous website, frozen outside pnpm and quality checks                            |
| `apps/api`                                         | Current Hono API, `@arcadia/api`; baseline for authenticated endpoint migration     |
| `packages/database`                                | Existing PostgreSQL schema, migrations, CLI/import dependencies                     |
| `packages/database/drizzle`                        | The only migration history; retain the existing ledger                              |
| `packages/contracts`                               | Existing Zod/API types; keep baseline contracts stable during migration             |
| `packages/domain`, `packages/i18n`, `packages/cli` | Existing catalog rules, vocabulary, and DB CLI                                      |
| `reference/arcadia-deploy`                         | Historical deployment recipes; not active local infrastructure                      |
| `docs/archive`                                     | Historical README/map snapshots; old release plans elsewhere in docs are historical |
| `data/backups`                                     | Private local backups, ignored by Git; never copy into images or commits            |

`data/arcadia.db` is a read-only legacy recovery source. PostgreSQL is the active catalog.
Keep existing UUIDs, relationships, notes, scores, account ownership, progress, and artwork.
Rust connections default to `default_transaction_read_only = on`; guarded mutation transactions opt into writes.
No startup migration/seed. Mutation tests and migration rehearsals use disposable restored DBs.

## Development and checks

Node 26 and Rust come from the project devenv shell. pnpm stays pinned at 11.11.0.
Oxlint and `@oxlint/plugins` are 1.87.0; Oxfmt is 0.72.0; `@shadcn/lint` is 0.2.0.
Biome has been removed. New UI follows [design-rules.md](./design-rules.md) and the shadcn skill.

```sh
devenv up                       # PostgreSQL + Rust server + new website; no Tauri
devenv --profile reference-api up       # Optional reference API alongside the new stack
pnpm dev                        # New website only; server must already be running
pnpm dev:server                 # Rust server only; DATABASE_URL required
pnpm dev:reference-api                 # Reference Hono API only
pnpm check                      # Oxlint → Oxfmt check → workspace tsc → Rust fmt/Clippy
pnpm build                      # Active TypeScript workspaces + Rust workspace
pnpm test:e2e                   # New website Playwright journeys
```

Outside an already-entered shell, prefix Node/Rust commands with `devenv shell --`.
New web: `http://127.0.0.1:23100`; Rust: `http://127.0.0.1:23103`;
PostgreSQL: `127.0.0.1:23102/arcadia`; legacy API: `127.0.0.1:23101`.
The Vite proxy sends `/api` to Rust; deployment addresses are not baked into the new app.

Rust configuration: `DATABASE_URL`, `NAHHASIO_BIND` (default loopback:23103), `RUST_LOG`.
Do not log database URLs, secrets, credential hashes, or raw session tokens.
Viewing playback belongs to the client; the selected GTK/libmpv shell follows the reviewed
transition plan. No player is introduced in the administration website.

## Data baseline

2026-10-07: 223 titles, 364 installments, 1,709 episodes, 828 artwork records, 3 catalog accounts.
Backup: `data/backups/nahhasio-baseline-20261007T103204Z/`.
Restored all 72 application/migration tables and matched row-count/content fingerprints.
All 828 artwork files matched database hashes. Actual artwork is under `~/Pictures/Arcadia`;
its archive was compared against the source. No schema migration or catalog/progress change was made for Phase 1.
An independent backup is required before a live migration; this local copy shares the laptop.

## Review rule

Finish the active phase, report its actual verification and remaining limits, then stop.
Aqua reviews the phase before authorizing the next. Do not interpret the old v0.3.5 checklists
as permission to continue past the current review boundary.

Tauri runtime, CLI, SDK dependencies, desktop signing configuration, release workflow, and
GTK/WebKit environment packages are removed. Media-engine code remains available in Git at
`69a3cc1:src-tauri/src/`; the archived website is reference only and is not installed/built.
The standalone legacy `flake.nix` was removed; devenv is the sole local environment definition.

Phase 1 verification: all 70 non-activity tables match baseline content fingerprints. Existing
sessions/history have no removed rows; one login was added and one view counter/timestamp was
refreshed during normal activity. `phase1-after.dump` preserves the latest state.
New web main/overview JS total 153.4 KiB gzip, CSS 10.9 KiB gzip; entry alone is 144.4 KiB.
Aqua expanded Phase 1 to the complete dashboard UI. Desktop work follows dashboard/API/database
completion. See `phases.md` for the current sequence.

Dashboard UI: `components/dashboard` owns reusable headers/tables;
`features/dashboard/{home,shell}` owns overview and navigation;
`features/catalog/{works,entities}` owns work browsing and people/studio/planet editing;
`features/artwork/library` owns registered images and provider helpers;
`features/database/{data,records,schema,validation,revisions,overview}` owns database tools;
`features/editor/{work,fields,references,artwork,structure,json}` owns structured/JSON editing.
Server pages live in `features/server/overview`; login lives in `features/auth`.
Database and server use different sidebar contexts. Current schema snapshot contains 71 public
tables and 559 columns, with no private row values. Upcoming mutation/service controls are disabled.

## Database dashboard review checkpoint — 2026-10-07

Aqua authorized TanStack Start and real database workflows, then requested a final commit and stop.
Start runs a private server-function bridge; dashboard routes disable SSR. Rust provides live schema,
paginated records, transactional create/update/delete, audit snapshots, and leaf-record restoration.
`NAHHASIO_LOCAL_ADMIN=true` plus a private token enables loopback development only. Start refuses
production, and Rust refuses release/non-loopback local administration. Production setup/login is pending.

Collections and raw tables are connected. Auth tables, audit logs, editorial revisions and jobs are
protected from generic writes. Edits detect stale originals; deletion refuses linked records.
Whole-work JSON export, rehearsal and merge reuse the existing CLI; source searches, media storage
and catalog validation reuse the existing API modules through server-only workspace exports.
The basic new-work form is connected; advanced structure/score/relation controls remain disabled there,
with those records editable through collections/raw tables and the complete JSON workbench.
TMDB/Fanart/AniList artwork search, explicit image ingest/upload, registered image serving,
media assignment records and TMDB season previews are connected. Provider success depends on keys
and upstream availability. Season previews do not automatically import episodes.

Preservation fixes: calendar dates round-trip as dates, repeated merge avoids duplicate trivia,
and media selection preserves existing assignment UUIDs rather than deleting/recreating links.
No migration or live catalog mutation was performed in implementation/testing. Mutation tests used
`nahhasio_dashboard_test`, restored from the verified snapshot. Private previews live in ignored
`data/previews`; secrets and backups remain ignored.

Review order at this historical checkpoint: manual dashboard feedback, improve structured editors and import previews,
complete production identity/setup and authorization, then watch-state/data-model work, server operations,
and finally Kotlin/Compose Linux. Do not start another milestone without Aqua's instruction.

Verification for this checkpoint: four Rust tests and Clippy passed; disposable database CRUD,
stale-write rejection, linked-record deletion rejection and restore passed; whole-work dry-run
rollback and repeated merge preservation passed. The live catalog check still matches all 70
non-activity tables; activity differences are the same previously documented session/history updates.
Run `node apps/server/tests/database-smoke.mjs` only with the isolated API on port 23104; the script
checks its connected database name before writing. `pnpm --filter @arcadia/cli exec tsx scripts/check-work-roundtrip.mts`
requires `DATABASE_URL` to point to `nahhasio_dashboard_test` and checks that name before writing.
These tests are intentionally outside default test commands.

## Local client foundation checkpoint — 2026-10-08

Aqua authorized three parallel tasks plus dashboard organization. Rust now exposes owner-only
login/session/logout and authorized `/api/v1/works`, work details, filters and registered artwork.
The shared OpenAPI contract and generator live in `packages/api-contract`; generate instead of
hand-editing Kotlin/TypeScript DTOs. The Linux client lives in `apps/linux` and consumes those models.
See [the detailed checkpoint](./local-client-foundation-2026-10-08.md) for verification and limits.

Minimal owner login uses existing credential hashes and linked active accounts. Aqua separately
requested a new local admin identity; it was created transactionally and audited without storing
credentials in source or audit metadata. Dashboard authentication uses HttpOnly cookies and
owner checks before its existing private local-admin bridge. Production/LAN dashboard admin is
still disabled. Do not reinstate an anonymous bridge or startup seed to make local access easier.

The first Linux client runs via `devenv shell -- apps/linux/gradlew -p apps/linux :composeApp:run`.
The project environment includes JDK21, Gradle, mpv, Chromium and Compose runtime libraries.
Streaming resolution, torrent transfer, downloads, saved packs, progress sync and provider sync
remain pending. The family PC runs Fedora Atomic with Podman and an existing Jellyfin; local
verification precedes SSH/deployment.

## Current handoff: GTK transition

Read [linux-client-plan.md](./linux-client-plan.md) before client work. Default devenv starts
PostgreSQL, API, dashboard and the verified GTK desktop with dependency readiness.
Kotlin/Gradle and their legacy profile were retired after a clean committed checkpoint. Aqua explicitly
requires confirmation after each step or visible change. Agent implements the first bootstrap;
then client Rust practice belongs to Aqua through commented tasks, hints and review.

## Verified GTK bootstrap — current

Kotlin/Gradle has been retired. `apps/linux` is a Rust GTK4/libadwaita/WebKitGTK shell;
`apps/linux/ui` is the separate React/Vite/TypeScript viewing interface. Production uses the
contained `nahhasio://app/` bundle origin. Native Rust owns the bearer session and HTTP requests;
UI replies are sanitized and parsed with the generated API contract.

`devenv up` now starts PostgreSQL, API, dashboard and the GTK desktop. `devenv up postgres server web`
starts only the backend; `devenv shell -- nahhasio-client` opens the desktop separately. No Java,
Gradle or broad Compose graphics environment remains. GTK/WebKit/GStreamer runtime dependencies
are project-local. See the client README and Linux plan for checks, boundaries and remaining work.
