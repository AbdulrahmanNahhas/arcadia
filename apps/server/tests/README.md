# Viewer-state PostgreSQL verification

`viewer_postgres.rs` is opt-in. Normal `cargo test --workspace --locked` compiles it but
skips both database/report tests. No database write is possible without the explicit
`NAHHASIO_RUN_VIEWER_DB_TEST=1` opt-in.

Run the disposable API test from the repository root, using the local development PostgreSQL
role (shown here as `aqua`):

```sh
NAHHASIO_RUN_VIEWER_DB_TEST=1 PGUSER=aqua devenv shell -- cargo test -p nahhasio-server --test viewer_postgres --locked disposable_postgres_viewer_api -- --ignored --nocapture
```

The harness:

1. Uses `pg_dump --schema-only --no-owner --no-privileges` with a read-only source session.
   No catalog, account, password, session, watched or artwork rows are copied.
2. Creates a unique `nahhasio_viewer_<random>_test` database through the maintenance database.
   It never reuses an existing test database.
3. Checks `current_database()` against the exact generated name and its disposable-name guard
   before restoring schema or inserting synthetic fixtures.
4. Exercises the real Axum router and owner session middleware with test-only identities.
   API connections default to read-only; actual mutations must opt into `READ WRITE`.
5. Verifies insert/upsert preservation, manual/future behavior, released counts, work/installment
   browse parity, target ancestry, unauthorized accounts and account isolation. Injected database
   failures prove rollback of partially touched bulk state and of a successful favorite write
   whose returned snapshot fails.
6. Removes **only the database it successfully created** and verifies removal, including when
   the test task fails or panics. No live API session is created and no live catalog write occurs.

A process forcibly killed by the OS cannot run teardown. In that case the unique database name
printed by the harness identifies the leftover; inspect that exact database before removing it.
Never sweep or remove other `*_test` databases.

The first restore test caught pg_dump's session `search_path` leaking into subsequent fixture
queries. The harness now resets the restore connection's settings before returning it to the pool.
No production endpoint fix was needed for the verified cases.

## Read-only detail payload report

```sh
NAHHASIO_RUN_VIEWER_READONLY_REPORT=1 devenv shell -- cargo test -p nahhasio-server --test viewer_postgres --locked representative_live_work_payload_sizes -- --ignored --nocapture
```

This uses production detail SQL via `./bin/arcadia sql`, which enforces a PostgreSQL `READ ONLY`
transaction. It scans JSONB detail sizes to identify the largest catalog candidate, then measures
compact UTF-8 JSON (the API serializer form) for that candidate and Oshi No Ko, Frieren and the
longest episode work at this checkpoint, Black Clover. It prints names/counts/byte sizes only,
not detail bodies, credentials or connection strings. No login/session is needed.

2026-10-09 measurements:

| Work                          | Episodes | Installments | Compact detail bytes |
| ----------------------------- | -------: | -----------: | -------------------: |
| Black Clover                  |      170 |            2 |               92,055 |
| Frieren: Beyond Journey's End |       38 |            3 |               32,307 |
| Oshi No Ko                    |       35 |            4 |               31,463 |

Black Clover was also the largest JSONB detail candidate. All measured payloads were below the
native 2,097,152-byte response limit. These are metadata payload measurements, not artwork bytes,
native rendering performance or a permanent upper bound as the catalog grows.
