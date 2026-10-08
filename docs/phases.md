# Nahhasio rewrite phases

Updated 2026-10-08. Work happens on `codex/nahhasio-server-first`.
Complete one phase, report changes and verification, then stop for Aqua's review.
Do not start the next phase until Aqua asks to continue.

## Decisions

- One repository: a pnpm workspace for the website/packages and a Cargo workspace for Rust.
  A Kotlin/Gradle client workspace joins it in the Linux-client phase.
- **Website = administration dashboard only.** Complete dashboard/API/database work before
  starting desktop clients. Database selection changes the complete sidebar workspace.
- New Rust server, TanStack Start/Vite website, Kotlin/Compose clients, and real Jellyfin for
  completed home-library files. The Git repository stays Arcadia for now.
- A full website redesign and new information architecture. The fresh app is `apps/web`;
  the old app is `reference/arcadia-web`, available for migration/reference, with no new features.
- Keep PostgreSQL. Measure query plans, payloads, and rendering before considering a database
  replacement. The current data model and access patterns need work; changing database engines
  is not a demonstrated performance fix.
- Oxlint + Oxfmt replace Biome. Keep the existing generic anti-slop plugin. Enforce all six
  `@shadcn/lint` rules on new website source and the official shadcn composition conventions.
- No global DOM scanner, web player, Tauri bridge, background chart library, or
  whole-catalog download in the new website. Use server pagination and intent-driven loads.
- Data preservation includes passwords/identity links, notes, progress, explicit watched states,
  scores, relations, artwork, and stable ids. A snapshot restore was verified before this work.
- Nuvio is a product/architecture reference. Implement Nahhasio's own code and retain this
  repository's license. Its family catalog/dashboard remain first-party responsibilities.

## V1.0 direction — local server and Linux client

This section records Aqua's updated product direction and supersedes the older milestone order
below where they conflict. V1.0 runs the Nahhasio server on Aqua's PC and the first native desktop
client on Linux. It supports catalog browsing and administration, torrent based playback or device
downloads, and playback of completed home-library files through Jellyfin. Remote access, public
accounts, Android/TV, iOS, and Netflix-style profile management are outside this first release.

Login should be small and real: one local owner account, securely stored password hash, revocable
session, and explicit owner/client permissions. Keep identity, profile, and device concepts
separate in the schema so profiles and additional accounts can be added later without replacing
the authentication foundation. Do not build profile selection or family account UX for V1.0.

The API is the main product foundation. Define one versioned OpenAPI contract, generate TypeScript
and Kotlin clients from it, and keep administrative endpoints separate from client permissions.
The client API needs paginated library search, composable filters and sorting, full work/episode
details, provider/source availability, registered artwork, playback resolution, download
operations, and playback-state sync. Keep filtering and pagination in SQL; never fetch the whole
catalog into the client. Design the first useful slice around login, browse/filter, work details,
and play one already available video.

Treat playback options as distinct workflows:

- **Save work** stores a local metadata/artwork/source pack, torrent identifiers or metainfo, and
  stable work/file mappings. It does not mean video is downloaded.
- **Device download** stores video on the Linux client for offline playback and is managed by the
  client.
- **Home-library download** is a durable server job. Verify the file before importing it to the
  library and making it available through Jellyfin.
- **Stream** resolves a playable source. Prefer the matching completed local file when present;
  otherwise use an available home-library or torrent source. Reuse in-progress torrent data where
  supported, and report source availability and failures honestly.

Release scheduling should be date driven rather than requiring an administrator to flip an
episode between upcoming/released states every week. Store the scheduled air/release date, source
and last verification; derive upcoming/available from that date and whether a playable source/file
exists. Allow an explicit correction/override with a reason for delays, regional dates, specials,
or provider mistakes. A date passing alone must not claim an episode is playable. Provider adapters
should preview proposed additions/changes before applying them, preserve editorial fields, and
record field provenance. Start with existing TMDB, AniList, Fanart and subtitle integrations where
they fit; treat provider IDs as identifiers and do not assume every provider supplies every field.

Database work may include removal or redesign of genuinely obsolete tables and fields. First
inventory live reads/writes, foreign keys, migration history, and data ownership. Preserve stable
catalog IDs, editorial notes/scores, identity ownership, playback history, source mappings, and
artwork unless Aqua explicitly approves a data-loss decision. Rehearse additive/backfill/retirement
migrations on a restored disposable copy, compare content fingerprints and constraints, and define
rollback before changing the live catalog. `packages/database/drizzle/` remains the sole migration
history unless a deliberate reviewed handover preserves its ledger.

### Work sequence before broad client development

| Step | Work                                                                                                                                                              | Exit point                                                                              |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| A    | Review the current dashboard/editor revision; organize TanStack routes and features so route entries stay small and feature data/UI are easy to find.             | Aqua can review the editorial workflows and proposed structure.                         |
| B    | Agree on the data model and release/source rules; inventory legacy tables and map current schema to catalog, identity, playback, source, media, and job concepts. | Migration plan and data-preservation/rollback evidence on a restored copy.              |
| C    | Establish minimal local login and authorization; write/version OpenAPI and generate web/Kotlin clients.                                                           | Owner dashboard and client permissions are enforced at server boundaries.               |
| D    | Implement client catalog read APIs, SQL pagination/filter/sort, work/episode details, provider-backed release dates and artwork, plus source availability.        | Linux client can browse real authorized catalog data without fetching the full library. |
| E    | Implement playback resolution and progress rules; test a completed Jellyfin file and a torrent through the Rust media core/mpv path.                              | One end-to-end play/resume journey works, including the downloaded-file preference.     |
| F    | Add durable home-library download jobs, verification/import/Jellyfin linking, and the essential dashboard queue/storage/recovery screens.                         | A selected episode reaches Jellyfin and survives server/worker restart and retry.       |
| G    | Add local saved-work packs, device downloads, offline playback/progress outbox, and client recovery.                                                              | Linux client can save metadata separately from video and play an offline download.      |

Steps can overlap when their contracts are stable. Start the Compose shell and a thin browse/detail
prototype as soon as steps C–D provide real endpoints; do not wait for every dashboard operations
screen or Android decision. Keep the v1 local deployment plain devenv processes until the product
works; packaging and Fedora/LAN deployment are separate release work.

### Proposed repository structure

This is the target organization to review before moving files; it does not authorize a large
mechanical refactor by itself. Retain current packages and migration ownership where useful, migrate
feature by feature, and keep generated files generated.

```text
apps/
  server/                       Rust API and worker entry points
  web/                          TanStack Start administration dashboard
    src/
      app/                      router, query client, app providers
      routes/                   thin route definitions and layouts
      features/
        catalog/                works, people, studios, planets, editorial forms
        images/                 image search, assignments, library
        imports/                provider previews and merge review
        operations/             jobs, storage, backups, health
        access/                 owner login, accounts, devices
      components/               shared dashboard composition
  linux/                        Kotlin/Gradle Compose desktop client
    composeApp/src/
      commonMain/               shared Compose screens and client logic
      jvmMain/                  Linux desktop, mpv and local storage adapters
      commonTest/               shared client tests
crates/
  api/                          Axum routes, auth middleware, OpenAPI
  application/                  catalog, access, playback and job use cases
  catalog/                      catalog rules and provider-independent models
  media/                         torrent transfer, local gateway and file verification
  integrations/                  TMDB, AniList, Fanart and subtitle provider adapters
packages/
  api-contract/                 OpenAPI source and generated TypeScript/Kotlin clients
  contracts/                    existing domain/import/editor contracts during migration
  database/                     schema, existing Drizzle migration ledger and DB tooling
  domain/                        existing TypeScript rules until each is deliberately migrated
  i18n/                           shared web vocabulary/localization
  cli/                            existing catalog maintenance CLI
docs/
  decisions/                     short architecture decision records
  runbooks/                      backup, restore, local setup, release recovery
  phases.md                      current delivery order and review checkpoints
```

TanStack organization rule: a route file declares path/layout and composes the feature page;
each feature keeps its query keys, typed server functions, schemas, and UI together. Shared code
belongs in `components` only after more than one feature needs it. Keep client-safe code separate
from server-only database/provider modules, and do not import private server implementation into
browser bundles. Rust crates should follow real dependency boundaries; do not create empty crates
just to match the diagram. The generated OpenAPI output is not hand-edited.

## Review milestones

| Milestone | Deliverable                                                                           | State                                                                                                                        |
| --------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 0         | Existing data restore and artwork verification                                        | Complete; baseline recorded below.                                                                                           |
| 1         | Local server foundation and administration dashboard                                  | Review ongoing; dashboard/editor changes are present in the working tree and must be reviewed before further implementation. |
| 2         | V1 data model, minimal local login, authorization, and API contract                   | Pending review of this plan.                                                                                                 |
| 3         | Client catalog API, release-date/provider workflows, and organized dashboard features | Pending.                                                                                                                     |
| 4         | Compose Linux browse/detail prototype and local-file/Jellyfin playback                | Pending; may begin once the needed API slice is stable.                                                                      |
| 5         | Torrent playback, server download jobs, and device offline/download workflows         | Pending.                                                                                                                     |
| 6         | V1.0 local packaging, recovery, and handoff                                           | Pending.                                                                                                                     |

Later: remote/LAN deployment, Android/Android TV, multiple Netflix-style profiles, and broader
account management. These should build on the V1 identity/device boundaries and API contract.

Fedora deployment can begin once a reviewed Rust release is ready; local v1 testing remains plain
devenv processes. Remote access, iOS, custom Jellyfin API emulation, and server remux exports remain
later work.

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

## Current review checkpoint — 2026-10-07

Aqua expanded today's scope to Start migration and connected database workflows, then asked for a
final commit, change list, next steps and a stop. The framework/spacing migration is `edcb858`.
The database implementation now includes local guarded Rust CRUD, real records and artwork,
whole-work JSON rehearsal/merge, source searches, season previews, validation and audit recovery.
This is a local development review checkpoint; production identity/setup/authorization and advanced
structured editorial UX remain unfinished. Server-management services remain upcoming.
No schema migration was made. Live catalog fingerprints remain unchanged apart from the two
previously documented activity-table changes. Future work begins after Aqua reviews this checkpoint.
