---
name: api-tests-need-tcp-postgres
description: devenv's Postgres listens on a unix socket that postgres.js cannot reach, so API/database tests need a disposable TCP cluster
metadata:
  type: project
---

`devenv up` starts PostgreSQL on a **unix socket** under `/run/user/1000/devenv-*/postgres`
(port 5433), not TCP 5432 — despite `devenv.nix` setting `listen_addresses = "127.0.0.1"` and
`DATABASE_URL = postgresql://127.0.0.1/arcadia`. `postgres.js` (used by `createDatabase` in
`packages/database/src/index.ts`) **cannot connect over a unix socket via a URL**: neither
`postgresql://%2Frun%2F...:5433/db` nor `postgresql:///db?host=/run/...&port=5433` works — both
fall back to TCP 127.0.0.1:5432 and get ECONNREFUSED.

**Why:** so running `vitest` for `@arcadia/api` or `@arcadia/database` outside `devenv up`'s own
process tree fails with connection errors that look like "the database is down" when it is not.

**How to apply:** spin up a disposable TCP cluster for those suites (this also matches CLAUDE.md's
"use a disposable database/schema for mutation tests"):

```bash
initdb -D "$T/data" -U postgres --auth=trust
pg_ctl -D "$T/data" -o "-p 55432 -k $T -c listen_addresses=127.0.0.1" -l "$T/log" start
createdb -h 127.0.0.1 -p 55432 -U postgres arcadia_test
DATABASE_URL="postgresql://postgres@127.0.0.1:55432/arcadia_test" pnpm --filter @arcadia/database exec drizzle-kit migrate --config drizzle.config.ts
DATABASE_URL="postgresql://postgres@127.0.0.1:55432/arcadia_test" pnpm --filter @arcadia/database exec tsx src/seed.ts
NODE_ENV=test ARCADIA_MOCK_AUTH=true DATABASE_URL="postgresql://postgres@127.0.0.1:55432/arcadia_test" <vitest ...>
```

Seeded-but-not-imported, only `apps/api/src/app.test.ts` fails — its assertions need the full v1
import (`pnpm db:import`), not just the seed. Everything else passes. See
[[arcadia-check-baseline-is-red]].
