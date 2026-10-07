# Nahhasio — current workspace map

Updated 2026-10-07. Read [phases.md](./phases.md) for the current milestone and review boundary.
The Git repository is still Arcadia; the product and new packages are named Nahhasio.

## Active code

| Path                                     | Responsibility                                                                              |
| ---------------------------------------- | ------------------------------------------------------------------------------------------- |
| `apps/server`                            | Rust/Axum/SQLx server. Phase 1: public liveness/readiness only, read-only DB sessions       |
| `apps/web`                               | Arabic-first TanStack Start/Vite dashboard, TanStack Router/Query, Base UI shadcn Nova               |
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

The Kotlin Linux app and shared Rust media crate are introduced in their phases. Do not create
empty packages or copy the legacy player/web architecture into the new website.

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
Rust foundation connections explicitly set `default_transaction_read_only = on`.
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
Native Linux playback is a future Compose/mpv client milestone, not part of the website.

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

Dashboard UI: `features/dashboard` owns shared headers/tables/server pages;
`features/database` owns collections/images/imports/schema/maintenance;
`features/editor` owns the work form and lazy CodeMirror JSON workbench.
Database and server use different sidebar contexts. Current schema snapshot contains 71 public
tables and 559 columns, with no private row values. Upcoming mutation/service controls are disabled.
