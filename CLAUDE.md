# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Arcadia v2 is an Arabic-first, RTL-first family media archive. It models titles as umbrella
records with seasons, films, specials, and episodes beneath them, then combines editorial
scores, family-safety classifications, people, studios, planets ("universes"), and
relationships in one searchable catalog.

pnpm monorepo:

```text
apps/api            Hono API and OpenAPI document
apps/web             React 19 and TanStack Start client (builds as a static SPA)
src-tauri            Tauri desktop shell wrapping apps/web's SPA build (Linux for now)
packages/contracts   shared Zod schemas and generated API types
packages/database    PostgreSQL schema, Drizzle migrations, seed, and v1 importer
packages/domain      taxonomy, classification, policy, and scoring rules (framework-independent)
packages/i18n        shared Arabic/English interface vocabulary and taxonomy labels
packages/cli         `arcadia` agent-facing CLI over the PostgreSQL catalog
```

## Commands

The project targets Node.js 26 and expects the Nix/devenv environment (`devenv shell -- <cmd>`,
or work inside a shell already entered with `devenv shell`).

- `devenv up` — start PostgreSQL, the API on port 23101, and the Tauri desktop app (which starts
  its own `apps/web` dev server as part of `tauri dev`; see "Desktop (Tauri)" in README.md).
- `pnpm dev` — run API + web dev servers in parallel in a browser, without devenv's Postgres or
  the desktop shell.
- `pnpm typecheck` — typecheck every workspace (`tsc --noEmit` per package).
- `pnpm test` — run Vitest across the monorepo (each package: `vitest run --passWithNoTests`).
- `pnpm build` — build every workspace.
- `pnpm check` — `oxlint .` then `biome check .` then `pnpm typecheck`. Run this before handoff.
- `pnpm format` — format the repo with Biome (Biome is the authoritative formatter/linter; oxlint
  runs additional rules including a local `anti-slop` plugin under `tools/oxlint/anti-slop/`).
- `nix shell nixpkgs#chromium --command devenv shell -- pnpm test:e2e` — Playwright, from `apps/web`.
- `pnpm tauri build` only produces a runnable bundle in CI, not on a NixOS dev machine — see
  "Desktop (Tauri)" in README.md.

Single-package/single-test scoping (run from repo root via pnpm `--filter`, or `cd` into the
package and use vitest args directly):

```bash
pnpm --filter @arcadia/api test
pnpm --filter @arcadia/web test
devenv shell -- pnpm --filter @arcadia/database exec vitest run src/schema.integration.test.ts
```

Database (never runs automatically at startup — always explicit):

```bash
devenv shell -- pnpm db:generate   # generate a Drizzle migration after schema.ts changes
devenv shell -- pnpm db:migrate
devenv shell -- pnpm db:seed
```

`data/arcadia.db` is a **read-only** v1 SQLite recovery/import source — never mutate it or add
local DB backups to the repo. To rebuild a v2 catalog from it:

```bash
devenv shell -- pnpm db:import -- --dry-run
devenv shell -- pnpm db:import
devenv shell -- pnpm db:restore:legacy   # db:import:knowledge + db:consolidate
```

The importer writes `migration-report.json` and never mutates the SQLite source.

Regenerate the checked-in API client types after changing the OpenAPI contract:

```bash
devenv shell -- pnpm client:generate
```

Read and edit the catalog from the CLI (`packages/cli`, talks straight to PostgreSQL — the API
does not need to be running):

```bash
./bin/arcadia health
./bin/arcadia title list --search "monster" --limit 20
./bin/arcadia title get <title-or-alias>          # references, not just UUIDs
./bin/arcadia schema titles                        # live column/enum introspection
./bin/arcadia stats coverage                       # catalog completeness
./bin/arcadia work apply new-work.json --dry-run   # whole-work create/update, one transaction
```

Use `./bin/arcadia`, not `devenv shell -- pnpm arcadia`: the devenv banner writes to stdout and
corrupts `--json` output. The CLI can edit every table, so writes support `--dry-run`, require
`--yes` past one row, and record `audit_logs` rows. Two skills document it in depth:
`.agents/skills/arcadia-db` (the interface) and `.agents/skills/arcadia-cataloging` (scoring,
classification, and the Arabic `contentWarnings`/`analysisNotes` conventions).

## Environment

`devenv.nix` supplies `DATABASE_URL` (`postgresql://127.0.0.1/arcadia`), `VITE_API_URL`
(`http://127.0.0.1:23101`), `ARCADIA_MOCK_AUTH=true`, and `ARCADIA_SEED_DEMO_ACCOUNTS=true` for
local dev. Browser routes use real cookie-backed Better Auth sessions; the test-only identity
bypass (`isTestAuthBypass()` in `apps/api/src/auth.ts`) is only honored when both
`NODE_ENV=test` and `ARCADIA_MOCK_AUTH=true` — never weaken this guard. Set a unique
`BETTER_AUTH_SECRET` and trusted `WEB_ORIGIN`/`ARCADIA_WEB_URL` outside development.

The dev seed creates three fixture accounts, only when `ARCADIA_SEED_DEMO_ACCOUNTS=true`
(admin/owner, family, personal — see README.md for credentials). Public account registration is
disabled: an owner creates accounts directly or issues an expiring invitation
(`/api/v1/invites/*`, `routes/invite.$token.tsx`).

## Architecture

**API (`apps/api/src`)** is a single Hono `OpenAPIHono` app (`app.ts`) that mounts feature route
modules (`features/{accounts,archive,awards,social}/routes.ts`) plus a large set of inline
routes for browse/detail/admin endpoints defined directly in `app.ts`. Data access mostly goes
through tagged-template SQL (`postgres.js`-style, via `database().client`) rather than an ORM
query builder at request time — Drizzle (`packages/database`) owns schema/migrations, but reads
in `app.ts`/`repository.ts` are hand-written SQL. `repository.ts` holds the shared browse/detail
query logic and account-visibility helpers (`visibilityPolicyForAccount`,
`visibleTitleIdsForAccount`) that every listing endpoint filters through.

Route layering:
- `/api/v1/*` requires an authenticated session except `health`, `invites/*`, and the test bypass.
- `/api/v1/admin/*` additionally requires `owner` or `editor` role; `editor` sessions are further
  gated per-path against `account_capabilities` (media/analytics/entities/accounts/catalog).
- Every non-GET admin mutation writes an `audit_logs` row after the handler runs.

Media uploads are content-addressed (`media-storage.ts`, hashed by sha256) and tracked in
`media_assets` / `media_asset_assignments`; deleting/reassigning goes through
`purgeUnreferencedMedia` so orphaned files get cleaned up. Vocabularies (genres, tones, tags,
countries, roles, and several "controlled" enums like audiences/ages/risk-levels) are editable
through `/api/v1/admin/vocabularies` with usage-count guards against deleting in-use terms.

**Domain (`packages/domain`)** is framework-independent and owns:
- `classification.ts` — family-safety classification levels and comparison/intersection.
- `policy.ts` — `VisibilityPolicy`/`isVisibleToPolicy` (what a profile can see) and
  `languagePolicySchema`; the API's visibility filtering builds on these primitives.
- `scoring.ts` — editorial score composition (story/characters/depth/world-building/
  originality/craft, 0–10 each).
- `taxonomy.ts` — canonical genre/tone/tag lists with English + Arabic labels and the
  `filterTreeSchema` boolean filter language (`and`/`or`/`not`/`in`) used by catalog filtering.

**Contracts (`packages/contracts`)** holds the Zod request/response schemas
(`src/index.ts`) that both API routes and web forms validate against, plus generated OpenAPI
types (`src/generated.ts`, produced by `pnpm client:generate` — do not hand-edit).

**Web (`apps/web/src`)** is TanStack Start/Router:
- `routes/` — file-based route entries (`admin.catalog.$workId.tsx` etc.); **never hand-edit
  `routeTree.gen.ts`** (generated, excluded from lint/format).
- `features/{catalog,profiles,library,platform,admin,entities,accounts,social,archive}/` —
  feature UI and logic, colocated with `*.test.ts(x)` unit tests.
- `components/` — reusable app components; `components/ui/` — shadcn primitives on Base UI.
- `lib/api.ts` — typed `openapi-fetch` client (`apiFetch`, `browseTitles`, `getTitle`, …) that
  always sends `credentials: "include"`.
- `server/*.functions.ts` — despite the name, plain async functions that call `lib/api.ts`'s
  `apiFetch`, not TanStack Start server functions (no `createServerFn`). Keep it that way: the app
  builds in TanStack Start's `spa` mode (`vite.config.ts`) for `src-tauri/`, which ships no Node
  server, so a real server function would work in the browser but break the desktop app.
- `public/media/` — static web assets (banners/logos/posters follow a
  `<slug>-<kind>-<hash>.<ext>` naming convention).

The web app is RTL-first (shadcn + Base UI + Tailwind CSS 4 + Phosphor icons). Reuse installed
primitives before adding new ones, use semantic theme tokens, preserve keyboard/screen-reader
behavior, and don't leave unreferenced component files (search for imports before removing a
component, then typecheck).

## Conventions

Strict, strongly typed TypeScript, two-space indentation. Biome is authoritative for
formatting/linting; oxlint adds correctness/suspicious/perf rules plus the local `anti-slop`
plugin (e.g. no chained type assertions, no object-parameter style, no reflect tricks — see
`oxlint.config.ts`). `PascalCase` for components/types, `camelCase` for values/functions,
kebab-case for routes and assets. Keep Zod validation at HTTP and import boundaries. Prefer
workspace package imports (`@arcadia/*`) over cross-package relative paths.

## Database and API safety

PostgreSQL is the source of truth for v2; `packages/database/drizzle/` is the only migration
history — don't recreate `legacy/`, `drizzle-v1/`, or a second migration tree. Use a disposable
database/schema for mutation tests. Generate a Drizzle migration for schema changes, keep
migration order intact, and call out data migrations explicitly. Update
`packages/contracts/` and regenerate the client (`pnpm client:generate`) when the public API
shape changes.

Mock profiles and the demo administrator PIN are UI fixtures, not authentication. Keep
development-only administrator endpoints behind the existing `TODO(auth)` boundary, and never
weaken the production auth guard.

## Testing and delivery

Vitest files live beside their units as `*.test.ts`/`*.test.tsx`; browser journeys live in
`apps/web/tests/*.spec.ts` (Playwright). Test observable behavior, API contracts,
classification/scoring rules, persisted preferences, and database constraints. Before handoff:
`pnpm check`, relevant tests, and `pnpm build`; run Playwright for visible or routing changes.
API/database integration tests expect the local PostgreSQL database to be migrated and seeded.

Use focused Conventional Commits (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`). PRs should
summarize behavior/schema changes, list verification commands, link issues, include screenshots
for visible UI work, and call out migrations, imported assets, and compatibility implications.
