# Nahhasio workspace map

Updated 2026-10-13. Read [phases.md](phases.md) for current authorization and review boundaries.
The repository remains Arcadia; the product and active Rust/client packages are Nahhasio.

## Responsibilities

| Path                               | Owner                                                                                    |
| ---------------------------------- | ---------------------------------------------------------------------------------------- |
| `apps/server/src/auth`             | Credential compatibility, viewer/admin login, own profiles and native bearer sessions    |
| `apps/server/src/catalog`          | Bounded discovery, details, artwork, releases and personal state                         |
| `apps/server/src/database.rs`      | Guarded transactional administration and audit recovery                                  |
| `apps/linux/src`                   | GTK lifecycle, contained assets, bridge, native session/network, player and device media |
| `apps/linux/ui/src`                | React presentation, query cache and validated native calls                               |
| `crates/native-player`             | Isolated GTK/libmpv adapter; examples are diagnostic                                     |
| `crates/media-transfer`            | UI-independent torrent engine, selected-file interests and SQLite job recovery           |
| `apps/web/src/features`            | Transitional administration UI and server functions                                      |
| `apps/api/src`                     | Legacy Hono routes and provider/media/validation services still used by administration   |
| `packages/api-contract`            | Active OpenAPI document, generator and validated TypeScript models                       |
| `packages/contracts`               | Legacy read/admin Zod schemas; obsolete generated HTTP types removed                     |
| `packages/database`                | PostgreSQL schema, Drizzle migration ledger and explicit recovery tools                  |
| `packages/cli`                     | CLI plus work-document and SQL helpers used by the dashboard                             |
| `packages/domain`, `packages/i18n` | Scoring, policy, taxonomy and editorial labels                                           |
| `tools/oxlint/anti-slop`           | Active project lint plugin                                                               |

The dashboard imports `@arcadia/api/{artwork,tmdb,media-storage,validation}` and
`@arcadia/cli/{db,work}`. Do not remove these services before replacing their consumers.
The desktop uses the Rust server directly and does not depend on the dashboard process.
Aqua wants future administration inside the client, retaining its RTL UI language.

## Development and checks

Use `devenv shell --` outside an existing shell. Node 26, pnpm 11.11.0, Rust, Python,
GTK4/libadwaita/WebKitGTK6, mpv, libtorrent and Chromium are project-local.
Do not inspect `/saved/nixos-config` without Aqua's permission.

`devenv up` starts PostgreSQL, Rust, dashboard and GTK. `devenv up postgres server` is backend
only; add `web` for the dashboard. `devenv shell -- nahhasio-client` builds/launches GTK.
Optional Hono API: `devenv --profile reference-api up`.

Ports: PostgreSQL `23102`, Rust `23103`, dashboard `23100`, Hono `23101`, client dev `23110`,
isolated player browser fixtures `23112`. Production GTK serves `nahhasio://app/`.

- `pnpm check`: lint, formatting, TypeScript, Rust formatting and Clippy.
- `pnpm build`: TypeScript builds and Cargo workspace build.
- `cargo test --workspace --locked`: SQL-free defaults; opt-in PostgreSQL tests remain ignored.
- `pnpm --filter @nahhasio/linux-ui test`: client unit tests.
- `pnpm --filter @nahhasio/linux-ui test:e2e`: fixture-backed packaged client journeys.
- `pnpm --filter @nahhasio/linux-ui test:e2e:player`: isolated player/download journeys.
- `pnpm test:e2e`: transitional dashboard journeys.
- `pnpm client:generate`: active OpenAPI TypeScript generation.

Legacy API/database integration suites may read/write `DATABASE_URL`; use disposable databases.
No startup migration, seed or import. Browser checks do not certify native GTK rendering,
physical input or playback. Follow [linux-client-testing.md](linux-client-testing.md).

## Preservation and authentication

PostgreSQL is canonical. Preserve IDs, ownership, credentials, notes, scores, artwork and viewing
state. `packages/database/drizzle/` is the single migration history. Rust sessions default read-only;
authorized mutations explicitly enter read-write transactions. Cleanup never changes the schema.

Current Rust auth supports active owner/admin/member identities with database-backed accounts. Local generic administration requires a debug server, loopback,
`NAHHASIO_LOCAL_ADMIN=true` and a private token; dashboard calls also require an owner session.
Future viewer/admin separation must be enforced by the server. Never expose private tokens,
bearer secrets, database credentials or arbitrary native commands to the interface.

`data/nahhasio.db` is a retained SQLite recovery candidate. Recovery tools require
`ARCADIA_V1_DB_PATH` explicitly. Backups, ideas, previews and `data/recovery/` are private/ignored.
Old root build artwork was moved intact to `data/recovery/legacy-build-artwork`.
Device jobs use an XDG SQLite store, independently of PostgreSQL.

## Evidence and history

Implemented playback/download behavior and limits: [linux-player-checkpoint.md](linux-player-checkpoint.md).
Work details and personal state: [linux-work-page-checkpoint-2026-10-10.md](linux-work-page-checkpoint-2026-10-10.md).
Provider availability depends on keys/upstreams; several server-admin pages are disabled placeholders.
Do not equate layout parity with implemented operations.

Removed references: `d77096f:reference/`. Tauri media: `69a3cc1:src-tauri/src/`. Kotlin: `28e3c72`.
Historical roadmap: [archive/nahhasio-roadmap.md](archive/nahhasio-roadmap.md).
Previous workspace/phase descriptions remain in Git. Historical approvals do not authorize new work.

## Accounts and client administration checkpoint

See [linux-accounts-checkpoint-2026-10-12.md](linux-accounts-checkpoint-2026-10-12.md).
The desktop has database-backed admin/member accounts, profile/password/avatar operations and
31 guarded empty admin sections. Only two requested local identities remain active; obsolete
demo identities are suspended with their ownership/history preserved. No administrative editing
workflow has moved yet. Restricted family policies fail closed pending server filtering.

## Reviewed discovery UI

See [linux-discovery-checkpoint-2026-10-13.md](linux-discovery-checkpoint-2026-10-13.md)
for Home/Search/Browse/Planet/People/Studio/Episodes, the Maia theme, Episode filters,
code cleanup, actual checks and the deferred Profile/Downloads/Calendar/Watch work.
