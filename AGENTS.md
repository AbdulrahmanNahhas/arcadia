# AGENTS.md

## Project and review boundary

Nahhasio is a private Arabic-first family media server, administration dashboard, and playback
client project. The Git repository remains Arcadia during the rewrite.
Read `docs/AGENT-CONTEXT.md` first, then `docs/phases.md` for the active milestone.
Complete one phase, report verification and limits, and stop for Aqua's review. Do not begin
another phase until Aqua asks to continue. The old v0.3.5 plans are historical references.

## Current Linux direction and approval checkpoints

Read `docs/linux-client-plan.md` for the latest decisions. It supersedes Kotlin/Compose plans.
Read `docs/linux-ui-review-tasks.md` for Aqua's current design checklist and the one-task review queue.
The Linux client will use a Rust GTK4/libadwaita shell, WebKitGTK, a separate React/Vite/TypeScript
interface, and libmpv. The administration dashboard remains separate from the viewing client.
Stremio's Linux shell and Aqua's screenshots are architectural/design references; inspect licenses
and implementation boundaries before reusing source. Preserve Nahhasio's catalog/family logic.

For this transition, Aqua explicitly requires confirmation after each step or visible change.
Work only within the approved step, show the concrete result and actual checks, then stop.
If Aqua rejects a design, discuss the direction before another implementation pass. Do not
continue polishing, propagate changes, delete a client, or start another milestone silently.
Permission already given for the current step covers its necessary implementation and checks.

Current approved milestone: Aqua confirmed the plan and authorized one continuous pass through
Kotlin retirement and the minimal runnable GTK client (real login and main library page), with
clean committed checkpoints before and after. Those steps may proceed within this approval;
stop at the resulting milestone or if Aqua rejects a visible direction. Playback/download
expansion and the learning phase need later review. Preserve unrelated work.

## Rust learning ownership

Aqua has nearly completed the Rust Book. For today's initial minimal runnable GTK client,
the agent may implement the Rust needed for a working shell, login and main library page.
After that reviewed baseline, Aqua practices the client Rust through small Rustlings-style tasks.
The agent owns UI/UX, API/database work, setup and organization; it supplies interfaces, guidance,
acceptance checks and reviews instead of automatically completing Aqua's client Rust exercises.

- Put a stable exercise ID, goal, allowed tools/crates, constraints, documentation links and
  acceptance criteria in task comments. Explain how the task fits the actual application.
- Ask short concept questions when useful; give progressively stronger hints, and let Aqua attempt
  the solution. Full solutions follow an explicit request, not an unattended subagent rewrite.
- Keep the working application intact while exercises are unfinished. Do not wire `todo!`,
  panics or simulated success into normal user flows. Prefer an isolated exercise/test module.
- Explain Rust changes and review reasoning, ownership/lifetimes, errors and async behavior.
- Subagents inherit these boundaries. Do not delegate Aqua's exercise implementation to them.

## Monorepo boundaries

- `apps/server`: Rust/Axum/Tokio/SQLx server, in the root Cargo workspace.
- `apps/web`: dashboard-only TanStack Start/Vite application, TanStack Router/Query, Tailwind 4, shadcn Base UI Nova.
- `reference/arcadia-web`: previous website, frozen outside active workspaces for porting reference.
- `apps/api`: previous Hono API, kept until Rust endpoints pass behavior/data checks.
- `packages/database`: existing PostgreSQL schema and the single migration history.
- Other `packages/*`: existing contracts, domain rules, vocabulary, and database CLI.

`apps/linux` contains the Rust GTK shell; `apps/linux/ui` is the separate React/Vite viewing UI.
The rejected Kotlin prototype was retired after a committed checkpoint. Do not create empty packages. Share media behavior in UI-independent Rust and network
contracts through the existing single generated OpenAPI definition.

## Development and checks

Use the repository's Nix/devenv environment: Node 26, pnpm 11.11.0, and Rust.
`devenv up` starts PostgreSQL, the Rust API, dashboard and GTK desktop with dependency ordering. The reference Hono API is available
with `devenv --profile reference-api up`. Do not inspect `/saved/nixos-config` without Aqua's permission.

- `pnpm lint`: Oxlint, the generic anti-slop plugin, and six shadcn design-system rules.
- `pnpm format` / `pnpm format:check`: Oxfmt, the authoritative formatter and import sorter.
- `pnpm typecheck`: TypeScript workspace checks.
- `pnpm check:rust`: new Rust workspace formatting and Clippy with warnings rejected.
- `pnpm check`: all the above. Run before handoff.
- `pnpm build`: TypeScript/website builds and new Rust workspace build.
- `cargo test --workspace --locked`: Rust unit tests, with no live catalog writes.
- `pnpm test:e2e`: new website Playwright journeys; use Chromium from Nix on this machine.

Run relevant tests and the build before handoff; run Playwright for visible/routing changes.
Database mutation tests require a disposable migrated/restored database. Default test commands
can include integration suites: never point them at the live family catalog.
Keep commits focused and conventional. Include actual checks and material limitations in reports.

## Website rules

These shadcn/TanStack composition rules apply to `apps/web`, the administration dashboard.
The separate viewing-client UI uses its own reviewed design tokens/components and responsive
layout. Preserve accessible labels, keyboard focus/navigation, RTL, reduced motion and typed
HTTP/native-bridge boundaries there as well. No dashboard interface inside the viewing client.

Follow the `shadcn` skill and `docs/design-rules.md`. Components use the official `@shadcn`
registry; retrieve current docs before composing them, inspect generated output, and install
only components that have consumers. Do not hand-edit vendored primitives to fix caller errors.

- Use component variants/sizes and semantic theme tokens. Caller classes control layout.
- Use Field/FieldGroup, full Card composition, and Empty/Alert/Badge for their respective roles.
- Group select/menu items correctly; every dialog has a title and every field an accessible label.
- Use logical RTL utilities, gaps, `size-*`, `cn`, and configured Lucide icons with `data-icon`.
- Keep native link semantics and keyboard/screen-reader behavior. Respect reduced motion.
- No raw colors, arbitrary values, inline styles, unrecognized classes, dynamic class construction,
  or component appearance overrides in new app source. Run the six `@shadcn/lint` rules.
- No suppression comments or extension of the legacy anti-slop allowlist in new source.
- No web player, Tauri bridge, global DOM navigation scanner, or whole-catalog fetch.
  TanStack Start server functions bridge the dashboard to private backend operations; route SSR is disabled.
- Put feature queries/UI together, keep route entries small, use server pagination, URL filters,
  typed query factories, request cancellation, and targeted cache invalidation.
- Do not copy remote state into effect-driven local state. Do not introduce persistent state
  without deciding its owner, scope, migration, and invalidation.

Do not hand-edit `routeTree.gen.ts` or `packages/contracts/src/generated.ts`.
Prefer workspace imports over cross-package relative imports. Use strongly typed TypeScript;
parse untrusted HTTP/import data at boundaries rather than weakening internal types.

## Database preservation and authentication

PostgreSQL is the source of truth. Preserve all catalog UUIDs, identity/ownership links,
notes, scores, relations, explicit watched state, playback progress, and artwork paths.
`packages/database/drizzle/` is the only migration history. Never add a second migration tree.
Changing data access to SQLx does not replace migration ownership or regenerate the schema.

Startup never runs migrations, seeds, imports, or cleanup jobs. Make schema changes additive,
rehearse/backfill on restored copies, verify counts/content/constraints, and define rollback.
Before a live cutover, secure a verified independent backup of both PostgreSQL and artwork.
`data/arcadia.db` is a read-only v1 recovery source. Backups are private and never committed.

The existing CLI is `./bin/arcadia` and talks directly to PostgreSQL. Use the `arcadia-db` skill
for live catalog reads/writes and the `arcadia-cataloging` skill for editorial classification.
Preserve the current Better Auth identity/password ownership during Rust migration; verify
hash compatibility with fixtures before cutover. Do not weaken existing production auth guards.
The legacy test bypass requires both `NODE_ENV=test` and `ARCADIA_MOCK_AUTH=true`.
Do not log secrets, database connection strings, password hashes, or session tokens.

Rust database sessions default to read-only. Explicitly authorized local development catalog
operations require the private server token; writes opt into transactional read-write mode.
Production setup/auth and device, sync, and job authorization remain future work.
Keep user identity, viewing profile, device, and library policy as distinct concepts.

## Rust and playback

Keep unsafe code out of the server workspace. Use bounded pools/timeouts, structured tracing,
clear feature boundaries, graceful shutdown, and ordinary transactional SQL.
The media core must not depend on Tauri/GTK or UI types. Platform players use adapters.
The selected new Linux player uses libmpv through an isolated native adapter; measure its actual
Wayland/XWayland/GPU/subtitle behavior. Inspect the working legacy Tauri player in Git history
before rewriting transfer/player logic. Device downloads, saved metadata/source packs, and home-library downloads
are different workflows with different ownership and recovery behavior.

## Current product order

Aqua explicitly prioritized the website as a dashboard only, with Database switching the entire
sidebar context. Cover existing editorial/admin workflows, TMDB, Fanart, images, raw table
inspection, JSON/bulk editing, maintenance, revisions, users/devices, and server operations.
UI routes may be prepared before their services; pending actions must stay visibly disabled.
Do not claim full database control from UI layouts. Connect authorization and transactional
mutations before enabling them. The approved next client checkpoint is only a runnable GTK shell,
real login and main library page; torrent/Jellyfin playback and downloads follow separate reviews.
