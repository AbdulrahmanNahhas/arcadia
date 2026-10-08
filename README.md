# Nahhasio

A private family media hub: a Rust server for the catalog and home library, an Arabic-first
administration dashboard, and a planned Rust GTK4/WebKitGTK viewing client.
The Git repository remains Arcadia while the product is rewritten in reviewed phases.

**Current milestone: local server/client foundation.** The dashboard has real local catalog
administration, structured and JSON editing, provider/artwork workflows, and schema inspection.
Owner authentication and the client catalog API are implemented. The rejected Kotlin prototype
is being retired in favor of a GTK4/libadwaita/WebKitGTK/libmpv shell with a React/Vite/TypeScript UI. Torrent playback, durable downloads, offline saving, and deployment remain later
checkpoints. See [the current Linux transition plan](docs/linux-client-plan.md) and [review milestones](docs/phases.md).

## Workspace

```text
apps/server          Rust server (Axum, Tokio, SQLx/PostgreSQL)
apps/web             TanStack Start administration dashboard (Base UI shadcn)
apps/linux           Rejected Kotlin prototype; GTK replacement awaits review
packages/api-contract OpenAPI and generated Kotlin/TypeScript models/clients
reference/arcadia-web      Previous website, isolated for migration/reference
apps/api             Previous API, retained until Rust endpoint parity
packages/database    Existing catalog schema and the single migration history
packages/*           Existing catalog contracts, rules, vocabulary, and CLI
```

This is one monorepo with pnpm/Cargo workspaces and an optional legacy Gradle prototype. The shared Rust media crate
will join when torrent playback is introduced. PostgreSQL and existing catalog data remain.

## Run locally

Use the project's Nix/devenv environment, targeting Node 26:

```sh
devenv up
```

This starts PostgreSQL, the Rust server, the dashboard, and the Linux desktop client. Open
[the website](http://127.0.0.1:23100). The Rust server uses port 23103 and the existing database
uses port 23102. Startup does not migrate or seed the database.

If the backend is already running, open just the desktop with `devenv shell -- nahhasio-client`.
For backend/dashboard only, use `devenv up postgres server web`. Do not start duplicate copies
on the same fixed ports; strict port checking deliberately reports the conflict.

The reference Hono API is available explicitly with `devenv --profile reference-api up`.
See [the workspace map](docs/AGENT-CONTEXT.md) for individual commands and transition paths.

## Quality and design

```sh
devenv shell -- pnpm check
devenv shell -- pnpm build
devenv shell -- cargo test --workspace --locked
```

Oxlint, the existing anti-slop plugin, Oxfmt, and `@shadcn/lint` enforce the new code conventions.
The dashboard uses TanStack Start server functions with route SSR disabled. Its private backend
bridge stays on the server; playback belongs to the Linux client. Read [the design rules](docs/design-rules.md).

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
