---
name: arcadia-cli
description: Inspect a running Arcadia v2 catalog through its read-only JSON API CLI. Use when an agent needs to check API and PostgreSQL readiness, search umbrella titles or flattened installments, fetch complete title details, or list public planets, people, studios, and relationships without querying databases directly.
---

# Arcadia CLI

Run commands from the Arcadia repository. Keep the v2 API running at
`http://127.0.0.1:3001`, or set `ARCADIA_API_URL` to its origin. Treat stdout as JSON and
stderr as diagnostics.

Check API and PostgreSQL readiness first:

```bash
devenv shell -- pnpm arcadia -- health
```

## Find works

Start broad, inspect `total`, then refine or paginate:

```bash
devenv shell -- pnpm arcadia -- titles --search "monster" --limit 20
devenv shell -- pnpm arcadia -- titles --mode installments --sort release
devenv shell -- pnpm arcadia -- titles --planet animation --genre drama --offset 20
```

Available filters mirror the v2 browse contract: `--search`, `--mode`, `--sort`, `--genre`,
`--tone`, `--tag`, `--planet`, `--limit`, and `--offset`. Inspect `total`, then refine or
paginate.

## Get complete work details

Use the exact UUID returned by `titles`:

```bash
devenv shell -- pnpm arcadia -- title <title-id>
```

Read `installments`, `relationships`, and `credits` for the normalized v2 structure.

## List public catalog resources

```bash
devenv shell -- pnpm arcadia -- list planets
devenv shell -- pnpm arcadia -- list people
devenv shell -- pnpm arcadia -- list studios
devenv shell -- pnpm arcadia -- list relationships
devenv shell -- pnpm arcadia -- list organization-relationships
```

Run `devenv shell -- pnpm arcadia -- --help` for the full interface. The CLI exposes only
public GET endpoints and cannot mutate the catalog. Use the current PostgreSQL schema in
`packages/database/src/schema.ts` only when API output needs structural interpretation; do
not open the retained v1 SQLite archive.
