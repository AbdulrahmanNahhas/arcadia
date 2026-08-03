---
name: arcadia-cli
description: Inspect the database of a running local Arcadia server through its read-only, JSON CLI. Use when an agent needs to list or filter works, fetch complete work details, discover database tables or columns, or inspect raw rows without opening Arcadia's SQLite file directly.
---

# Arcadia CLI

Run commands from the Arcadia repository. Keep the development server running at
`http://127.0.0.1:3000`, or set `ARCADIA_URL` to its origin. Treat stdout as JSON.

## Find works

Start broad, inspect `total`, then refine or paginate:

```bash
devenv shell -- pnpm arcadia -- works --search "monster" --limit 20
devenv shell -- pnpm arcadia -- works --kind anime --genre Drama --status completed
devenv shell -- pnpm arcadia -- works --favorite --year-from 2020
```

Repeat a filter or comma-separate values to match any supplied value. Different
filters combine with AND. Use `--offset` with `--limit` for pagination.

## Get complete work details

Use the exact ID returned by `works`:

```bash
devenv shell -- pnpm arcadia -- work <work-id>
```

Read `work` for the normalized projection, `structure` and `trackingEntries` for
activity data, and `records` for the raw rows connected to that work.

## Inspect any table

Discover before querying unfamiliar data:

```bash
devenv shell -- pnpm arcadia -- tables
devenv shell -- pnpm arcadia -- schema work_terms
devenv shell -- pnpm arcadia -- table work_terms --where work_id=<work-id> --limit 100
```

Repeat `--where column=value` to combine exact predicates with AND. Add
`--order <column> --desc` when stable ordering matters. Use the literal value
`null` to match SQL NULL.

Run `devenv shell -- pnpm arcadia -- --help` for the complete option list. Do not
write to the database through another tool while using this skill; this CLI is
intentionally read-only.
