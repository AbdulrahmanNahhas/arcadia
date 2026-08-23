# Arcadia

Arcadia v2 is an Arabic-first, RTL-first family media archive. It models titles as umbrella
records with seasons, films, specials, and episodes beneath them, then combines editorial
scores, family-safety classifications, people, studios, planets, and relationships in one
searchable catalog.

The project is a pnpm monorepo:

```text
apps/api            Hono API and OpenAPI document
apps/web            React 19 and TanStack Start client
packages/contracts  shared Zod schemas and generated API types
packages/database   PostgreSQL schema, migrations, seed, and v1 importer
packages/domain     taxonomy, classification, policy, and scoring rules
packages/i18n       shared Arabic interface vocabulary and taxonomy labels
scripts             repository command-line tools
```

## Development

Arcadia targets Node.js 26. Enter the reproducible Nix environment and start PostgreSQL, the
API on port 3001, and the web app on port 3000:

```bash
devenv up
```

`DATABASE_URL`, `VITE_API_URL`, the local Better Auth secret, and demo-seed flag are supplied
by `devenv.nix`. Browser routes use real cookie-backed sessions; the test-only identity bypass
is accepted only when both `NODE_ENV=test` and `ARCADIA_MOCK_AUTH=true`.

Database changes are explicit; startup never runs migrations automatically:

```bash
devenv shell -- pnpm db:generate
devenv shell -- pnpm db:migrate
devenv shell -- pnpm db:seed
```

In the development environment the seed creates three local accounts. They are fixtures for
manual testing and are never created unless `ARCADIA_SEED_DEMO_ACCOUNTS=true`:

| نوع الحساب | اسم المستخدم | كلمة المرور |
| --- | --- | --- |
| مالك العائلة | `admin` | `ArcadiaAdmin!2026` |
| عائلي | `family` | `ArcadiaFamily!2026` |
| شخصي | `personal` | `ArcadiaPersonal!2026` |

Set a unique `BETTER_AUTH_SECRET` and trusted `WEB_ORIGIN` outside development. Public account
registration is disabled: an owner creates an account directly or issues an expiring invitation.

The active database is PostgreSQL and its migration history lives only in
`packages/database/drizzle/`. The single retained `data/arcadia.db` file is a read-only v1
recovery/import source. To rebuild a v2 catalog from it:

```bash
devenv shell -- pnpm db:import -- --dry-run
devenv shell -- pnpm db:import
devenv shell -- pnpm db:restore:legacy
```

The importer writes `migration-report.json` and never mutates the SQLite source.

## API and CLI

OpenAPI is available at `http://127.0.0.1:3001/openapi.json`.

`./bin/arcadia` reads and edits the catalog directly against PostgreSQL (no API server needed):

```bash
./bin/arcadia health
./bin/arcadia title list --search "monster" --limit 20
./bin/arcadia title get <title-or-alias>
./bin/arcadia stats coverage
./bin/arcadia work apply new-work.json --dry-run
./bin/arcadia help
```

Set `DATABASE_URL` to point at another database, and `ARCADIA_CLI_ACTOR` to attribute the
`audit_logs` rows it writes. Regenerate checked-in API types after changing the OpenAPI
contract:

```bash
devenv shell -- pnpm client:generate
```

Catalog, account, award, and social payloads are validated by the shared Zod schemas in
`packages/contracts`. Interface wording and common option labels live in `packages/i18n`; feature
components should not duplicate either set locally.

## Verification

Run the static checks, unit/integration tests, and production builds inside the Nix
environment. API and database integration tests expect the development PostgreSQL database
to be migrated and seeded.

```bash
devenv shell -- pnpm check
devenv shell -- pnpm test
devenv shell -- pnpm build
nix shell nixpkgs#chromium --command devenv shell -- pnpm test:e2e
```
