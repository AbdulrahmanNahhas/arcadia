# Arcadia

Arcadia is a local-first, configurable media knowledge base built with TanStack
Start, React, TypeScript, TanStack Router and Query, shadcn/ui on Base UI,
Tailwind CSS, Drizzle ORM, SQLite, and Zod.

The database uses one generic work model for anime, animated and live-action
series, movies, manga, novels, games, visual novels, and comics. Objective
metadata, personal state, vocabularies, people/organizations, collections,
assets, links, and future similarity artifacts remain separate.

## NixOS development

This project targets Node.js 26 and does not require global Node or pnpm:

```bash
nix develop
pnpm dev
```

For a one-off command:

```bash
nix develop path:.
pnpm build
```

The SQLite database is stored at `data/arcadia.db` in WAL mode. Set
`ARCADIA_DB_PATH` to use another local path.

## Literature seed and audit

The literature seed adds the curated local manga and novel catalog without
touching imported animation records. It is safe to rerun. The audit is
read-only and reports catalog counts plus referential-integrity and duplicate
vocabulary checks.

```bash
pnpm db:seed:literature
pnpm db:fetch-literature-covers
pnpm db:clean
pnpm db:audit
```

`db:clean` applies Arcadia's controlled genre, tag, and tone vocabularies to
every work and records the review date.
