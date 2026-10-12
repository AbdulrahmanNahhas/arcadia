# Nahhasio

A private Arabic-first family media hub: Rust server, PostgreSQL catalog, and a Rust
GTK4/libadwaita/WebKitGTK client. The Git repository remains Arcadia during the rewrite.

The client includes authenticated discovery, work details, watched/favorite state, releases,
local/torrent playback and device downloads. See the [player checkpoint](docs/linux-player-checkpoint.md)
and [work-page checkpoint](docs/linux-work-page-checkpoint-2026-10-10.md) for actual evidence and limits.

The TanStack Start website currently owns administration. Aqua wants those workflows inside an
administrator-only Linux client area using its existing visual language, then the website retired.
Tailwind/shadcn UI foundation work precedes administration. Jellyfin, home-server jobs, deployment
and synchronized playback remain separate work.

## Workspace

| Path                                               | Responsibility                                                                       |
| -------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `apps/server`                                      | Rust/Axum/SQLx identity, catalog, personal state and guarded database administration |
| `apps/linux`                                       | GTK shell, contained assets, native bridge, session/network ownership and playback   |
| `apps/linux/ui`                                    | React/Vite/TypeScript, TanStack Router/Query, Tailwind 4 and shadcn Base UI Nova     |
| `apps/web`                                         | Transitional TanStack Start administration dashboard                                 |
| `apps/api`                                         | Legacy Hono API and provider/media/validation services still used by administration  |
| `crates/native-player`                             | GTK/libmpv adapter and diagnostic examples                                           |
| `crates/media-transfer`                            | Torrent engine, durable device jobs and recovery                                     |
| `packages/api-contract`                            | Active OpenAPI source and generated validated client                                 |
| `packages/contracts`                               | Legacy catalog/admin Zod schemas                                                     |
| `packages/database`                                | PostgreSQL schema, single migration history and explicit recovery tools              |
| `packages/domain`, `packages/i18n`, `packages/cli` | Catalog rules, editorial labels and command-line operations                          |

Frozen website/deployment references were removed; tracked source remains at `d77096f:reference/`
in Git. Legacy Tauri media code is at `69a3cc1:src-tauri/src/`; Kotlin is recoverable at `28e3c72`.

## Development

Use the repository's Nix/devenv environment: Node 26, pnpm 11.11.0 and Rust.

```sh
devenv up                              # PostgreSQL, Rust API, dashboard and GTK client
devenv up postgres server               # Backend only
devenv up postgres server web           # Backend and transitional dashboard
devenv shell -- nahhasio-client          # Build and launch desktop
devenv --profile reference-api up        # Optional legacy Hono API
```

Ports: PostgreSQL `23102`, Rust `23103`, dashboard `23100`, Hono `23101`, client UI dev `23110`.
The desktop depends on Rust API readiness, not dashboard readiness. Startup never migrates,
seeds or imports. Avoid duplicate processes on these ports.

```sh
devenv shell -- pnpm check
devenv shell -- pnpm build
devenv shell -- cargo test --workspace --locked
devenv shell -- pnpm --filter @nahhasio/linux-ui test
devenv shell -- pnpm --filter @nahhasio/linux-ui test:e2e
devenv shell -- pnpm --filter @nahhasio/linux-ui test:e2e:player
devenv shell -- pnpm client:generate
```

Legacy integration suites require a disposable database. Never run them against the live catalog.
See [desktop verification](docs/linux-client-testing.md) for native isolation and reporting.

## Preservation

PostgreSQL owns the catalog; `packages/database/drizzle/` is the only migration history.
Backups, artwork and captures are private/ignored. `data/nahhasio.db` is a retained SQLite recovery
candidate. Recovery tools require `ARCADIA_V1_DB_PATH` explicitly rather than guessing a filename.
Old build artwork was preserved in `data/recovery/legacy-build-artwork` and has not been reconciled
against the live catalog. Device job state uses `$XDG_STATE_HOME/nahhasio`; retained videos normally
use `~/Videos/nahhasio`. Device storage is independent of PostgreSQL.

Native Rust owns secrets. The packaged UI uses `nahhasio://app/` and a bounded bridge;
administrative permission must be enforced on the server. Read [the workspace map](docs/AGENT-CONTEXT.md)
and [approved sequence](docs/phases.md). Complete a checkpoint and return for review.

Licensed MIT. Catalog data and artwork are not distributed with the code.
