# Repository cleanup — 2026-10-12

Aqua authorized cleanup, removal of the reference trees and a commit before the Linux UI
foundation and administration migration. This checkpoint adds no product features.

## Changes

- Removed 440 tracked files from the frozen website/deployment reference trees, plus their
  ignored build residue. Historical source remains at `d77096f:reference/` in Git.
- Removed the unused library hero, Linux Sheet/Slider, dashboard Progress, Effect lint extension,
  legacy generated HTTP types/export/generator and unused CLI workspace dependencies.
- Moved the production GTK/libmpv adapter into `crates/native-player`, renamed its Cargo package,
  updated consumers/examples and reused the application runtime launcher for diagnostics.
- Consolidated player journeys on `playwright.player.config.ts`/port 23112 and removed the
  obsolete in-memory bridge-export workaround. Wired existing Linux unit tests into `pnpm test`.
- Corrected `pnpm client:generate` to the active OpenAPI package and added Python to devenv.
- Resolved the Linux shadcn utility alias with `src/lib/utils.ts`; preserved installed controls.
- Removed dashboard readiness from desktop dependencies. Added native development libraries
  and client fixture journeys to CI; corrected its misleading local-seeding comment.
- Replaced conflicting current-state docs with a concise workspace map/delivery sequence;
  archived the historical data/deployment roadmap. Recorded Linux administration as the future
  direction, following the requested Tailwind/shadcn foundation.
- Recovery tools now require an explicit `ARCADIA_V1_DB_PATH` instead of guessing an absent
  `data/arcadia.db`. The retained `data/nahhasio.db` remains unmodified/unclassified.
- Moved old build artwork intact to ignored `data/recovery/legacy-build-artwork` (206 MB) before
  removing stale root compiled output. Removed old test/native scratch artifacts; retained native
  incremental build cache, backups, ideas and useful private captures.
- Refreshed stale client browser assertions for enabled Watch/download actions, search-page
  navigation, scoped filter controls, responsive hero dimensions, current browse fixtures and
  primary card navigation. Application visual behavior was preserved.

## Verification

Commands use `devenv shell --` and pnpm 11.11.0. No live catalog writes, migration, seed or
public torrent download was performed. Legacy API/database integration suites were excluded;
SQL-free unit runs removed `DATABASE_URL`, and native smoke used isolated device storage and
an unreachable API on port 9.

| Check                                                                 | Result                                                                                        |
| --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `pnpm check`                                                          | Passed lint, format, TypeScript, Rust formatting and all-target Clippy with warnings rejected |
| `pnpm build`                                                          | Passed all active TypeScript and Cargo workspace builds                                       |
| `cargo test --workspace --locked`                                     | Passed; both opt-in PostgreSQL tests stayed ignored                                           |
| Selected Linux/web/domain/i18n/contracts/CLI/API-contract unit suites | 159 passed                                                                                    |
| `pnpm client:generate`                                                | Passed; active generated output unchanged                                                     |
| Explicit recovery-source checks                                       | Passed without opening SQLite or PostgreSQL                                                   |
| `pnpm --filter @nahhasio/linux-ui test:e2e:player`                    | 17 passed                                                                                     |
| Full packaged Linux browser journeys                                  | 57 passed                                                                                     |
| Isolated logged-out dashboard journeys                                | 2 passed, 27 authenticated journeys skipped without disposable credentials                    |
| Shell syntax and `git diff --check`                                   | Passed                                                                                        |

The first full client run had 51 passes and six failures. All six failures were reproduced on
pre-cleanup source from `HEAD` in a temporary baseline copy with the same installed dependencies.
They concerned outdated selectors/fixtures and expectations for disabled actions, the former
search dialog, fixed hero height and detail-button navigation. Existing assertions were updated
without skipping tests or changing product flows.

## Native verification limit

Fresh `target/debug/nahhasio-linux --player-smoke` loaded actual H.264 with `vulkan-copy`, exercised
saved-file attachment preserving session/catalog identity, pause/resume, seek and subtitle/style
controls, then failed its rendering threshold. The first isolated run recorded 2 frames in two
seconds. A retry using freshly generated animated 640×360/30 fps H.264/AAC/subtitle media recorded
7 frames in two seconds, below the required 20. No threshold, compositor policy or player code
was relaxed. This does not certify native smoothness/fullscreen/preview or physical input.
The root cause remains unresolved; do not claim a complete native smoke pass.

Private logs are in ignored `data/previews/cleanup-native/`; snapshot capture was not reached.
Tested native binary SHA-256:
`12f91d24751938c3ed7accade0b865146a1aec290b1b0f3baeb1f0721a11e8c7`.
Packaged `ui/dist/index.html` SHA-256:
`253baf51b89f92acf35546e4c9be8200b7dde134884ddffe72e3f40da3e93e03`.
Existing font/accessibility/graphics warnings remain. Linux bundle chunk-size warning remains.
CI configuration was updated but GitHub-hosted execution was not run locally.

## Next checkpoint

Convert remaining client page/player selectors to Tailwind utilities and current shadcn controls,
retaining imports/theme/font/global-accessibility CSS and the reviewed RTL visual language.
Framework choice remains under discussion; TanStack Router + Query is recommended for this
packaged native client, while Start SPA mode is possible without using its server features.
Admin API/authorization and workflow migration follow the foundation review.
