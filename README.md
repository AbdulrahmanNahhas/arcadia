# Nahhasio

A private family media hub: a Rust server for the catalog and home library, an Arabic-first
administration dashboard, and Kotlin/Compose clients for playback.
The Git repository remains Arcadia while the product is rewritten in reviewed phases.

**Current milestone: Phase 1 — foundation.** The Rust server exposes read-only health checks;
the dashboard contains all planned database/server page layouts, a real schema explorer, and
local work/JSON drafts. Record access and mutations arrive after authentication/API connection;
upcoming service actions remain disabled. Desktop work starts after dashboard/API/data completion. See [the phases and review milestones](docs/phases.md).

## Workspace

```text
apps/server          Rust server (Axum, Tokio, SQLx/PostgreSQL)
apps/web             New React/Vite website (TanStack, Base UI shadcn)
reference/arcadia-web      Previous website, isolated for migration/reference
apps/api             Previous API, retained until Rust endpoint parity
packages/database    Existing catalog schema and the single migration history
packages/*           Existing catalog contracts, rules, vocabulary, and CLI
```

This is one monorepo with pnpm and Cargo workspaces. The Kotlin/Gradle client and shared Rust
media crate join it in their respective phases. PostgreSQL and all existing catalog data remain.

## Run locally

Use the project's Nix/devenv environment, targeting Node 26:

```sh
devenv up
```

This starts PostgreSQL, the Rust server, and the new website. Open
[the website](http://127.0.0.1:23100). The Rust server uses port 23103 and the existing database
uses port 23102. Startup does not migrate or seed the database.

The reference Hono API is available explicitly with `devenv --profile reference-api up`.
See [the workspace map](docs/AGENT-CONTEXT.md) for individual commands and transition paths.

## Quality and design

```sh
devenv shell -- pnpm check
devenv shell -- pnpm build
devenv shell -- cargo test --workspace --locked
```

Oxlint, the existing anti-slop plugin, Oxfmt, and `@shadcn/lint` enforce the new code conventions.
Biome is removed. The website is a plain SPA: no desktop bridge, video player, global focus
scanner, or Node rendering server. Read [the design rules](docs/design-rules.md).

Database mutation tests require a disposable database. Never run migrations, imports, seeds,
or cleanup jobs against the live family catalog just to get a test to pass.

## Data and deployment

PostgreSQL owns the catalog; `packages/database/drizzle/` is the only migration history.
The retained `data/arcadia.db` is a read-only v1 recovery source. Actual artwork and database
backups are outside Git and must be preserved alongside the database.

Rootless Podman on Fedora Atomic is the intended home deployment. Previous Arcadia deployment recipes are archived under `reference/arcadia-deploy`; Rust/Jellyfin deployment is a later reviewed phase. The website's future
**Download to home library** action will queue a persistent torrent job, verify/import the file,
and refresh a real Jellyfin library. Client-side torrent streaming is a separate capability.

Historical setup and feature documentation is preserved in
[the Arcadia README snapshot](docs/archive/arcadia-readme.md).

Licensed MIT. Catalog data and artwork are not distributed with the code.
