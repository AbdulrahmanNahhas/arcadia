# Nahhasio Linux client: architecture, design and Rust practice

Decision record — 2026-10-08. Aqua selected this direction after rejecting the Kotlin/Compose
prototype. This document controls the client transition; older Kotlin plans and screenshots
are historical evidence, not the next implementation target.

## Confirmed decisions and current scope

- Linux first. Rust GTK4/libadwaita shell, WebKitGTK, libmpv, and a separate **React + Vite +
  TypeScript** client interface. Electron and Kotlin/Compose are not the chosen implementation.
- The Rust/Axum server, PostgreSQL, versioned OpenAPI and TanStack Start administration dashboard
  remain. The viewing client has no administration dashboard.
- V1 runs locally on Aqua's PC/Linux desktop. Later deploy the server on the family PC: Fedora
  Atomic, Podman and an existing Jellyfin. SSH/deployment follow a working local checkpoint.
- Today the agent may write the implementation needed for the first runnable native shell,
  real login and main library page. After that baseline, Aqua practices client Rust through
  exercises; the agent handles UI/UX, API/database, project setup and organization.
- Confirmation after **each step and each visible change**. Show a concrete result and actual
  verification, then stop. A rejected design requires discussion before another coding pass.
- Current step: repair/verify devenv, record this plan, update AGENTS/context, and return for review.
  Kotlin removal and new-client implementation are the next approved checkpoint, not this step.
- `devenv up` should ultimately start backend plus the new desktop. During the transition it starts
  PostgreSQL → API → dashboard, without automatically launching the rejected Kotlin prototype.

## Product scope to preserve

The server owns the curated catalog, identity, authorization, artwork, editorial records and
synchronized state. The dashboard owns editing and server administration. Clients browse and watch.

The viewing client must support:

- Home shelves and discovery; all-library search, combined advanced filters and sorting.
  Use bounded paginated requests and intent-driven loading rather than a whole-catalog fetch.
- Complete work information: summaries, aliases, dates, installments/episodes, scores, family
  risks, warnings, analysis, people/studios/credits, awards, genres/tones/tags/countries, planets,
  artwork and relations. Keep absent data absent, and distinguish inherited episode classification.
- Torrent playback, subtitle/audio selection, seeking, fullscreen, progress and recovery.
- Existing home-library files via the server's Jellyfin integration.
- Device video downloads, queue/status, storage controls and restart recovery.
- Saved work packs, offline browsing/playback and a progress outbox for later synchronization.
- Minimal owner login now; identities/profiles/devices remain separate concepts so family and
  Netflix-like profile features can be added later. No profile-management expansion in the first shell.

**Save work** means local metadata, artwork, provider/torrent identifiers or metainfo, source
candidates and stable episode/file mappings. It does not imply downloaded video.
**Download video to device** means actual media on that client. **Download to home library** is
an independent durable server job that verifies/imports files and links Jellyfin.
**Play** prefers the matching completed device file when available, then an authorized home-library
or torrent source. Partial torrent playback should reuse the existing transfer/pieces. A registered
file mapping or passed release date alone is not proof that video can be played.

Date-driven episode release state and provider-backed episode previews/imports remain important.
TMDB/AniList/Fanart/subtitle integrations should reduce repeated manual entry, keep provenance,
allow corrections/delays and preserve curated notes/scores. Provider synchronization and new schema
work are separate milestones. Never overwrite editorial content through an automatic import.

## Design direction

Aqua's supplied Stremio screenshots are the reference for the **home, discovery and settings**
experience. They are saved locally in ignored `data/ideas/stremio/` so ephemeral clipboard files
are not the only copy. They are reference material, not distributed app artwork.

- Slim icon navigation rail, a prominent search field and generous but useful spacing.
- Poster-led shelves with section headings; discovery has a clean grid and selected-work preview.
- Coherent dark surfaces, restrained accent, strong readable hierarchy and consistent controls.
- Proper keyboard focus/navigation, Arabic/RTL, accessibility and reduced motion.
- Adapt to narrow/wide windows and HiDPI. Layout changes rather than scaling or clipping a fixed canvas.
- Work pages need Nahhasio's richer catalog: summary, playback/episode navigation and clearly grouped
  information/risks/analysis. Tabs/disclosures are useful; do not turn metadata into an admin form
  or flatten all information into a long unstructured text block. Technical IDs remain accessible
  in additional details instead of dominating normal reading.
- No fake shelves, fabricated ratings, invented episode stills, or connected-looking disabled services.

Review sequence: one login/home/discovery representative, stop for Aqua's review; then one work
page, stop again; then player UI. Do not redesign all screens unattended or keep iterating after
Aqua rejects the direction.

## Architecture and proposed layout

The desktop shell owns native lifecycle, WebKit setup, the validated bridge, credentials, native
player/device state, filesystem access and background operations. The web UI owns presentation
and interactions. The Rust server remains the source of catalog truth; no direct PostgreSQL
credentials in either client UI or native client.

```text
apps/
  server/                      Rust/Axum API and later durable workers
  web/                         TanStack Start administration dashboard
  linux/                       replace Kotlin only after retirement review
    Cargo.toml                 Rust GTK shell package, added when it has working code
    src/
      main.rs                  small entry point
      app/                     window, lifecycle, WebKit configuration
      bridge/                  typed request/reply/event boundary and origin checks
      services/                API/session/catalog adapters
      player/                  isolated libmpv adapter in its playback phase
      storage/                 local packs/download/progress ownership in its phase
      exercises/               Aqua's bounded Rust practice, after the bootstrap
    ui/                        independent React/Vite/TypeScript package
      src/
        app/                   navigation and client providers
        features/              auth, home/discover, work, player, saved, downloads
        components/            reviewed reusable client controls
        styles/                named design tokens and responsive layout
packages/
  api-contract/                one OpenAPI source and generated boundary types/client
  database/                    existing schema and only migration ledger
  contracts/domain/i18n/cli/   retained while consumers exist
crates/                        only introduce actual shared Rust consumers
  media-core/                  UI-independent torrent/gateway behavior when extracted
```

The diagram is a target, not permission to create empty directories/crates. Confirm exact names,
Cargo workspace/lint boundaries and bridge types before implementing the shell. GTK/libmpv FFI
requirements must not weaken the server's no-unsafe boundary. Keep the shared media core free of
GTK/Tauri/WebKit/UI types.

The TypeScript UI uses a small typed gateway interface: login/logout, list/filter catalog and
work details first. The approved implementation must establish which calls stay in native Rust
and which safe HTTP operations can be direct. Do not put a bearer token into URLs or publish a
private administrator token to JavaScript. Supply clear response types and errors, not an
unrestricted command/function dispatch bridge.

## Existing code and references

- [Stremio Linux shell](https://github.com/Stremio/stremio-linux-shell): verified Rust GTK4 +
  libadwaita + WebKitGTK + libmpv shell. Its startup points at a proxied web application; this is
  architectural guidance, not permission to load an untrusted remote UI with native privileges.
- [Stremio web](https://github.com/Stremio/stremio-web): separate React UI, currently built with
  Webpack. Our choice is Vite/TypeScript; matching the shell approach does not require its bundler.
- The shell declares GPL-3.0-only. Use independent code unless a specific reuse/license decision
  is reviewed. Keep dependency versions pinned and review source/license compatibility before copying.
- The working earlier Tauri player is in local branch `master` (Aqua called it main). Read through
  Git history without checking out over dirty work. Initial inventory: `src-tauri/src/player/`,
  `torrent/`, `downloads/`, `diagnostics.rs`, with libmpv2/librqbit/range gateway and download registry.
  Behavior/package tests are evidence to carry forward; platform-specific GTK3/Tauri glue needs adaptation.
- Current Kotlin code is a rejected prototype, not a new fallback design. Remove it only at the
  next explicit retirement step, including Gradle/JVM launch/tooling and Kotlin codegen output.
- Keep Hono/provider/CLI modules until final consumers migrate. Preserve Drizzle's migration history,
  live UUIDs, identities, watched state, progress, notes, scores, relations and artwork.

## Security and updates

Bundle our own UI for production. Restrict WebKit navigation/native bridge access to the approved
app origin; open external links without bridge privileges. Validate bridge command schemas,
origins, message limits and response types. Treat metadata, imports, torrent metainfo, filenames
and external URLs as untrusted input; do not render arbitrary HTML or grant unrestricted filesystem,
shell/process or local-network access through a message handler.

Use bounded requests/pools, cancellation, explicit media roots and private transfer endpoints.
Keep secrets out of logs, source, URL parameters and browser storage. Preserve auth checks and
content-policy ownership; offline access cannot promise immediate revocation while disconnected.
Persistent client state needs an explicit owner, schema/migration and invalidation policy.

A weekly upstream Stremio/dependency review is an idea for later: compare releases/changes,
identify relevant fixes, inspect security/license impact, test and selectively integrate.
No automatic code merge, remote UI replacement, executable update, or scheduled automation is
created by this plan. Update packaging/rollback and server migration checks are separate work.

## Rust practice after the first runnable checkpoint

The first baseline must work before exercises begin. Afterward tasks should grow out of actual
features, preserving the working version while Aqua experiments. Start with a brief concept quiz
when useful and tailor the task to what Aqua understands.

A task comment should include:

```rust
// AQUA TASK R03 — Fetch one bounded catalog page.
// Goal: use the agreed typed API response and report useful errors.
// Allowed: the selected HTTP client, serde, Result and the existing async runtime.
// Constraints: no secrets in logs, no whole-library fetch, retain cancellation/timeout.
// Read: relevant official crate docs and Rust Book chapters before requesting a solution.
// Done when: the named acceptance checks pass and you can explain ownership/error flow.
// Hints: ask for the next hint; no full solution is injected automatically.
```

Suggested progression (exact tasks chosen after baseline review): typed configuration/errors;
login/session lifecycle; paginated catalog/filter requests; validated UI bridge messages; player
commands/events and cancellation; persistent download state/recovery; saved packs and progress
outbox; conflict handling and useful tests. Provide documentation links, ask Aqua to reason,
review the attempt, and give graduated hints. Full solutions require an explicit request.
No `todo!`, panic placeholder or fake success in normal user flows; isolate unfinished exercises.
Subagents obey the same ownership boundary.

## Approval checkpoints and fresh-chat handoff

1. **Now:** repaired devenv + this plan + AGENTS/context. Show actual startup/shutdown checks;
   stop for review and commit confirmation. Preserve all unrelated pending source work.
2. **Next:** approved Kotlin retirement, inspect the old player and Stremio bridge/render approach,
   agree minimal GTK package/UI boundary, then stop for review.
3. **Bootstrap:** agent implements a runnable GTK shell with real login and a main library page,
   verifies it on Shadow and stops after each visible milestone. Add desktop to `devenv up` only
   when this startup path is working.
4. **Learning:** Aqua owns the selected Rust exercises; agent owns UI/UX/API/database support.
   Work-page completeness, player, torrents, Jellyfin, saved packs and downloads each have a
   separate concrete task/review rather than a one-pass promise.
5. **Deployment/platforms:** family PC SSH/Podman/Jellyfin, then Android/TV toolkit evaluation.
   No deployment or new chat is automatically created by this document.

Keep commits focused and conventional. Review the exact file scope before committing because the
worktree contains substantial earlier uncommitted server/dashboard/API work. Never commit private
backups, artwork, session files, screenshots or local credentials as incidental staging.

## Verification of the approved environment step

2026-10-08: default shell evaluation passed. Cold backend-only startup and native readiness wait
passed; a managed API restart succeeded. API database readiness returned200, dashboard login200,
unauthenticated client catalog401, and the existing private dashboard schema bridge200. A read-only
catalog query found223titles. `pnpm check` and `pnpm build` passed; the two logged-out/login-form
Chromium journeys passed. No schema migration, seed, catalog mutation or Kotlin deletion occurred
in this step. Running services remain available for review.

Useful first learning references (choose a small section per exercise rather than reading all
of these before starting): [Rust + GTK4 book](https://gtk-rs.org/gtk4-rs/stable/latest/book/),
[WebKitGTK Rust bindings](https://docs.rs/webkit6/latest/webkit6/), and
[reqwest HTTP client](https://docs.rs/reqwest/latest/reqwest/). Select dependency versions against
our locked Nix toolchain when implementing, rather than copying upstream version numbers.
