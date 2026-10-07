# Nahhasio rewrite phases

Updated 2026-10-07. Work happens on `codex/nahhasio-server-first`.
Complete one phase, report changes and verification, then stop for Aqua's review.
Do not start the next phase until Aqua asks to continue.

## Decisions

- One repository: a pnpm workspace for the website/packages and a Cargo workspace for Rust.
  A Kotlin/Gradle client workspace joins it in the Linux-client phase.
- **Website = administration dashboard only.** Complete dashboard/API/database work before
  starting desktop clients. Database selection changes the complete sidebar workspace.
- New Rust server, plain React/Vite website, Kotlin/Compose clients, and real Jellyfin for
  completed home-library files. The Git repository stays Arcadia for now.
- A full website redesign and new information architecture. The fresh app is `apps/web`;
  the old app is `reference/arcadia-web`, available for migration/reference, with no new features.
- Keep PostgreSQL. Measure query plans, payloads, and rendering before considering a database
  replacement. The current data model and access patterns need work; changing database engines
  is not a demonstrated performance fix.
- Oxlint + Oxfmt replace Biome. Keep the existing generic anti-slop plugin. Enforce all six
  `@shadcn/lint` rules on new website source and the official shadcn composition conventions.
- No global DOM scanner, web player, Tauri bridge, SSR runtime, background chart library, or
  whole-catalog download in the new website. Use server pagination and intent-driven loads.
- Data preservation includes passwords/identity links, notes, progress, explicit watched states,
  scores, relations, artwork, and stable ids. A snapshot restore was verified before this work.
- Nuvio is a product/architecture reference. Implement Nahhasio's own code and retain this
  repository's license. Its family catalog/dashboard remain first-party responsibilities.

## Review milestones

| Phase | Deliverable                                                    | Review evidence                                                                                                         | State                          |
| ----- | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| 0     | Existing-data baseline, restore and artwork verification       | Restored snapshot, checked hashes, preserved runtime activity                                                           | Done                           |
| 1     | Local monorepo/tools/Rust foundation and complete dashboard UI | All database/server screens, context-switching sidebar, work/JSON editors, disabled upcoming services, browser checks   | In progress — expanded by Aqua |
| 2     | Rust authentication and authorized catalog/schema reads        | Existing credentials/ownership retained; real paginated records; editor/owner boundaries                                | Pending                        |
| 3     | Full database control and editorial services                   | Transactional create/update/trash/restore, episodes, vocabularies, awards, bulk/JSON, TMDB/Fanart, images and revisions | Pending                        |
| 4     | Data-model and watch-state improvements                        | Additive/backfilled profile/device/progress model; no lost manual states; sync conflict tests                           | Pending                        |
| 5     | Server operations and connected services                       | Durable jobs, library/downloads/Jellyfin, backups, logs, controlled updates; complete dashboard/API checks              | Pending                        |
| 6     | Minimal Kotlin/Compose Linux app                               | Login, browse, detail, mpv playback, persisted progress; extend after review                                            | Pending                        |
| 7     | Home deployment and subsequent platforms                       | Fedora rootless Podman, LAN auth, monitored releases; Android/TV later                                                  | Pending                        |

Fedora deployment can begin once a reviewed Rust release is ready; local laptop testing remains
plain devenv processes. Desktop implementation does not begin ahead of dashboard/API/data work.

Android and Android TV follow the verified Linux client. Remote access, iOS, custom Jellyfin
API emulation, server remux exports, and larger integrations are later milestones.

## Phase 1 boundaries

Deliver real infrastructure without exposing catalog data through an unauthenticated API.

- Rust health endpoints distinguish liveness from database readiness and return no catalog counts.
- Rust database sessions are read-only; startup never migrates, seeds, or imports.
- The new website uses real health responses and identifies its catalog surface as forthcoming.
  No fake accounts, fake titles, fabricated download jobs, or connected-looking failure state.
- Generated shadcn source is managed through the official CLI and excluded from project-style
  rules. App source uses component variants, semantic colors, named utilities, and accessible
  composition. Generated routes and client types are never hand-edited.
- The old website is frozen in `reference/arcadia-web`, outside active workspaces and checks.
  Tauri runtime/tooling is removed; media code remains in Git history for the later Rust extraction.
  Remaining API/domain legacy allowlists may only shrink. New source receives no exemptions.
- Historical roadmap snapshots remain reference material. New decisions live here; current
  paths and commands live in `AGENT-CONTEXT.md`.

## Phase 2–3 data work

Authentication and playback data must be designed together, before the client starts writing.

1. Distinguish login identity, viewing profile, device, and library permission. Map existing
   catalog accounts to these concepts explicitly, preserving ownership and ids.
2. Verify the exact installed Better Auth scrypt implementation against Rust fixtures before
   accepting existing credentials. Hash upgrades happen only after password verification.
3. Add versioned playback events with unique event ids, device/session ids, local sequence,
   position/duration, and explicit watched/unwatched intent. Retry writes idempotently.
4. Build per-profile playback projections transactionally. Define competing-session rules;
   neither maximum position nor untrusted wall-clock timestamps settle every conflict.
5. Backfill existing playback states and manual watched overrides, compare projections, and
   retain the original rows until the migration passes review.
6. Add a local client outbox and sync cursor. Seeking backward, rewatching, offline ordering,
   two devices, duplicate retries, and a revoked device must have explicit behavior and tests.

`packages/database/drizzle/` stays the only migration history. SQLx owns Rust data access;
do not create an independent second schema/migration tree during the transition. All mutation
tests use disposable restored databases. A future migration-tool handover must preserve the ledger.

## Performance evidence

The goal is measured responsiveness; zero lag cannot be asserted from a technology choice.

- Record compressed website JS, CSS, initial requests, and app-owned source size after Phase 1.
- Keep the initial entry JS target below 150 KiB gzip; load heavier editors/charts only on their routes.
- Benchmark catalog list/detail against the real data volume and use SQL pagination, query-plan
  checks, indexes, bounded database pools, and cancellable client requests.
- Display downloads through bounded status updates/SSE; never rerender the whole UI on every
  playback or torrent tick.
- Test the Linux client on Aqua's actual desktop: Wayland/XWayland, GPU, Arabic fonts, HiDPI,
  startup, memory, seeking, subtitles, fullscreen, and shutdown. Begin with mpv's local IPC;
  embedded video is a later decision after the baseline works.

## References

- [Nuvio Desktop](https://github.com/NuvioMedia/NuvioDesktop): Kotlin/Compose desktop reference.
- [Nuvio Mobile](https://github.com/NuvioMedia/NuvioMobile): shared Compose app and platform adapters.
- [shadcn lint](https://github.com/shadcn-ui/lint): design-system enforcement through Oxlint.
- [Oxfmt configuration](https://oxc.rs/docs/guide/usage/formatter/config.html).
- [Original architecture and preservation analysis](./nahhasio-roadmap.md).

## Later website-managed updates

Aqua requested daily Fedora checks and eventual updates from the website. In the deployment
phase, expose release/version status, authenticated update requests, progress, and rollback
results. A narrow rootless service applies approved image versions; the web/API process does
not receive arbitrary shell execution or root access. Database migrations require a compatible
release and verified backup. Kotlin client downloads and update verification are separate.
No Podman, remote deployment, or update agent is introduced for local laptop testing.

## Phase 1 results — 2026-10-07

- Local `devenv up`: PostgreSQL 17, Rust server, and website; no containers or deployment.
- Tauri runtime, SDK/CLI dependencies, GTK/WebKit setup, signing examples, and release/publish
  workflows removed. Old website/deployment are frozen in `reference/`; media code is in Git history.
- Official shadcn Sidebar, mobile drawer, Tooltip provider, Breadcrumb, Card, Button, Badge,
  Alert, and Empty composition. Responsive media-query subscription uses `useSyncExternalStore`.
- Oxlint 1.87.0, Oxfmt 0.72.0, and shadcn lint 0.2.0. All six shadcn rules were verified
  with deliberately invalid temporary source, then the source was removed.
- `pnpm check`, workspace build, 3 Rust tests, 21 domain tests, and 5 Playwright journeys passed.
- Main JS: 147,858 bytes gzip (144.4 KiB); overview route: 9,268 bytes gzip (9.1 KiB).
  Total JS: 153.4 KiB gzip; CSS: 10.9 KiB gzip. These are foundation measurements, not feature parity
  with the previous app. A minified-chunk size warning remains; it does not establish runtime lag.
- All 70 non-activity tables exactly match baseline row-count/content fingerprints. The two
  activity tables contain one added login session and one refreshed view timestamp/visit count;
  comparing against the restored baseline found no removed records. A fresh database snapshot
  including that activity is `phase1-after.dump` beside the original private backup.
- The Rust API exposes health only and uses read-only database sessions. Authentication, live
  catalog pages/editing, watch-state migration, and the Linux client remain in subsequent phases.

The UI phase was subsequently expanded by Aqua to a dashboard-only website with all admin pages.
The initial shell measurements above are a historical checkpoint; record the expanded UI below.
