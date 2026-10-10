# Nahhasio Linux shell

Rust GTK4/libadwaita window with WebKitGTK hosting an independent React/Vite/TypeScript viewing UI.
The rejected Kotlin prototype is recoverable at commit `28e3c72`; it is removed from active source.
The server and administration dashboard remain separate.

## First milestone

Real owner login, native in-memory session, catalog shelves, discovery search/filter/sort with
bounded paging, registered artwork and selected-work overview/family/data preview. Native tokens
never cross into JavaScript. The UI checks generated OpenAPI schemas at its transport boundary.
No startup catalog migration or seed. Native local/torrent playback and Torrentio Watch actions
are now connected; see [the runnable player checkpoint](../../docs/linux-player-checkpoint.md)
for commands, security boundaries, actual checks and unfinished download/resume features.
Jellyfin is outside the client-media work.

## Organization

- `src/main.rs`: application/window lifecycle, approved UI origin and WebKit integration.
- `src/bridge.rs`: bounded request/reply protocol and resource identifiers.
- `src/services.rs`: timed/bounded authenticated HTTP operations and session ownership.
- `src/assets.rs`: contained `nahhasio://app/` production bundle serving.
- `src/smoke.rs`: explicit app-owned native UI verification using private stdin credentials.
- `ui/src/app`: app/session composition.
- `ui/src/features`: login, catalog and selected-work preview.
- `ui/src/lib/bridge.ts`: typed gateway and native reply parsing.
- `ui/src/styles`: reviewed responsive client tokens and layout.

Use the project devenv environment. Native builds use GTK4, libadwaita and WebKitGTK6 development
libraries from the locked Nix environment. Build UI with `pnpm --filter @nahhasio/linux-ui build`,
then native with `cargo build -p nahhasio-linux --locked -j 2`. Launch everything with `devenv up`, or just the desktop with
`devenv shell -- nahhasio-client`. Backend only: `devenv up postgres server web`.
The production UI is served as `nahhasio://app/`; no unrestricted file access or remote app UI.

For transport checks, `--bridge-smoke` accepts bounded JSONL commands on stdin. `--ui-smoke` accepts
one private `{email,password}` object on stdin, drives the actual login/catalog/logout flow and
captures app-owned WebKit snapshots. Neither mode logs credentials. Do not pass secrets in argv
or commit screenshots/session fixtures. UI browser tests use a clearly isolated bridge fixture;
native/server checks use actual endpoints separately.

## Rust practice after review

Today's bootstrap was implemented by the agent with Aqua's explicit approval. Once this baseline
is reviewed, Aqua owns the selected client Rust exercises; the agent handles UI/API/database/setup
and provides comments, hints, docs and review. Preserve the working app while practicing.

Initial exercises can work on the real boundaries: configuration/address validation and errors;
typed catalog response handling; cancellation/session lifetime; then libmpv events/commands and
transfer/download recovery. Every task gets a stable ID, goal, allowed tools, constraints and
acceptance checks before Aqua starts. No full solution is inserted unless requested.

Stremio's shell was inspected for its architecture and APIs, not copied. The implementation is
independent. See `docs/linux-client-plan.md` and `ui/README.md` for the approved design and security
boundaries. Dependency/library license decisions precede any future upstream source reuse.
