# Repository Guidelines

## Project Structure & Module Organization

Arcadia is a TanStack Start application. Route entry points live in `src/routes/`; do not hand-edit `src/routeTree.gen.ts`. Feature UI and domain logic belong in `src/features/`, reusable shadcn/Base UI components in `src/components/ui/`, server functions in `src/server/`, and shared utilities in `src/lib/`. Database schema, client setup, and repositories are under `src/db/`; generated SQL migrations live in `drizzle/`. Import tooling belongs in `scripts/`, browser tests in `tests/`, and local artwork in `public/media/`.

## Build, Test, and Development Commands

Use the Nix environment; global Node or pnpm is not required. The project targets Node.js 26.

- `devenv shell -- pnpm dev` — start Vite on port 3000.
- `devenv shell -- pnpm typecheck` — run strict TypeScript checks.
- `devenv shell -- pnpm test` — run Vitest tests once.
- `nix shell nixpkgs#chromium --command devenv shell -- pnpm test:e2e` — run the Playwright smoke flow.
- `devenv shell -- pnpm build` — build client and SSR bundles.
- `devenv shell -- pnpm format` / `pnpm check` — write or verify Prettier formatting.
- `devenv shell -- pnpm db:generate` — generate a Drizzle migration after schema changes.

## Coding Style & Naming Conventions

Write strongly typed React and TypeScript with two-space indentation. Prettier is authoritative; Tailwind classes are sorted by `prettier-plugin-tailwindcss`. Use `PascalCase` for components and types, `camelCase` for functions and variables, and kebab-case for route or asset names. Keep Zod validation at server boundaries. Prefer Phosphor icons and existing shadcn/Base UI primitives over custom controls.

## Testing Guidelines

Add Vitest files as `*.test.ts` or `*.test.tsx`; keep end-to-end journeys in `tests/*.mjs`. Test observable behavior, persisted preferences, filtering semantics, and database mutations. Use a temporary `ARCADIA_DB_PATH` for mutation tests—never modify `data/arcadia.db`. Run typecheck, relevant tests, and the production build before handoff.

## Commit & Pull Request Guidelines

History currently follows Conventional Commits (`feat: initial commit`). Continue with concise prefixes such as `feat:`, `fix:`, `refactor:`, and `test:`. Keep commits focused. Pull requests should explain behavior and schema changes, list verification commands, link relevant issues, and include screenshots for visible UI changes. Call out migrations, imported assets, and compatibility considerations explicitly.
