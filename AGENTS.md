# Repository Guidelines

## Architecture and ownership

Arcadia v2 is a pnpm monorepo. Keep browser routes and UI in `apps/web/src/`, the Hono API
in `apps/api/src/`, and shared behavior in the package that owns it:

- `packages/contracts/` owns Zod request/response schemas and generated OpenAPI types.
- `packages/database/` owns the PostgreSQL schema, Drizzle migrations, seeds, and v1 import.
- `packages/domain/` owns framework-independent taxonomy, policy, classification, and scores.
- `packages/i18n/` owns shared Arabic and English interface vocabulary.

TanStack route entry points live in `apps/web/src/routes/`; never hand-edit
`apps/web/src/routeTree.gen.ts`. Put feature UI in `apps/web/src/features/`, reusable app
components in `apps/web/src/components/`, shadcn/Base UI primitives in
`apps/web/src/components/ui/`, and browser-facing API adapters in `apps/web/src/lib/` or
`apps/web/src/server/`. Store web assets in `apps/web/public/media/`.

The active migration history is `packages/database/drizzle/`. Do not recreate `legacy/`,
`drizzle-v1/`, or a second migration tree. `data/arcadia.db` is the sole retained v1 recovery
source and must remain read-only.

## Commands

Use the Nix environment; the project targets Node.js 26.

- `devenv up` — start PostgreSQL, the API on port 3001, and the web app on port 3000.
- `devenv shell -- pnpm typecheck` — typecheck every workspace.
- `devenv shell -- pnpm test` — run Vitest across the monorepo.
- `devenv shell -- pnpm build` — build/check every workspace.
- `devenv shell -- pnpm check` — run Biome and TypeScript checks.
- `devenv shell -- pnpm format` — format the repository with Biome.
- `devenv shell -- pnpm db:generate` — generate a migration after schema changes.
- `devenv shell -- pnpm db:migrate` / `pnpm db:seed` — prepare the local v2 database.
- `nix shell nixpkgs#chromium --command devenv shell -- pnpm test:e2e` — run Playwright.

## Code and UI conventions

Write strict, strongly typed TypeScript with two-space indentation. Biome is authoritative.
Use `PascalCase` for components and types, `camelCase` for values and functions, and
kebab-case for routes and assets. Keep Zod validation at HTTP and import boundaries. Prefer
workspace package imports over cross-package relative paths.

The web app is RTL-first and uses shadcn components built on Base UI, Tailwind CSS 4, and
Phosphor icons. Reuse installed primitives before creating controls, use semantic theme
tokens, preserve keyboard and screen-reader behavior, and do not keep unreferenced component
files. Run an import search before removing a component and typecheck after pruning it.

## Database and API safety

PostgreSQL is the source of truth for v2. Never mutate `data/arcadia.db` or add local database
backups to the repository. Use a disposable database or schema for mutation tests. Generate a
Drizzle migration for schema changes, keep migration order intact, and call out data migrations
explicitly. Update `packages/contracts/` and regenerate the client when the public API changes.

Mock profiles and the demo administrator PIN are UI fixtures, not authentication. Keep all
development administrator endpoints behind the existing `TODO(auth)` boundary, and never
weaken the production guard.

## Testing and delivery

Place Vitest files beside their units as `*.test.ts` or `*.test.tsx`; keep browser journeys in
`apps/web/tests/*.spec.ts`. Test observable behavior, API contracts, classification/scoring
rules, persisted preferences, and database constraints. Before handoff, run `pnpm check`,
relevant tests, and `pnpm build`; run Playwright for visible or routing changes.

Use focused Conventional Commits such as `feat:`, `fix:`, `refactor:`, `test:`, and `docs:`.
Pull requests should summarize behavior and schema changes, list verification commands, link
issues, and include screenshots for visible UI work. Call out migrations, imported assets, and
compatibility implications.
