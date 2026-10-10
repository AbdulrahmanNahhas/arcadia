# Linux work-page review checkpoint

2026-10-10. Implementation is ready for Aqua's design review, uncommitted. Playback,
torrents and downloads are outside this checkpoint; their buttons remain disabled.

## Reviewed scope

- Five wrapping tabs with selected surfaces, Arabic labels and larger badges. Changing a tab
  or season preserves the viewing scroll container; the family tab is removed.
- Overview summary is complete and unboxed. Neither overview nor hero has an expansion
  button or summary dialog; the hero retains its four-line excerpt.
- Overview installments use the existing `MediaCard` with installment-specific artwork,
  scores, status, destination and actual watched state.
- Individual family risks are back in the sticky sidebar. Content warnings use the maximum
  sexuality/behavioral risk; analysis uses theology risk. Both cards and sidebar retain
  severity badges, with semantic green/yellow/red colors and neutral none.
- Three-column desktop episode grid, no search field, normalized numeric episode labels.
  Whole image/title/summary links open details; the episode URL also survives reload.
  Escape clears that URL parameter and restores the opening trigger. Watched, details,
  disabled watch and disabled download actions are siblings, not nested controls.
- Explicitly registered RTL spatial keyboard navigation, native Tab/Enter/Escape behavior,
  image focus rings, and initially focused dialog headings. No global navigation scanner.
- Rich crew links, collapsed scoring explanation, direct external sources at the start of
  the data tab, colored linked planet cards. Identity/aliases/work artwork sections removed.
- Actual account-scoped favorite/manual watched APIs and read-only paginated family activity.
  Release completion is not watched state or proof of playable availability. Manual bulk
  watched changes require confirmation and preserve playback progress.

Main source: `apps/linux/ui/src/features/work/`, shared navigation in
`apps/linux/ui/src/components/card-navigation.tsx`, scroll ownership in
`apps/linux/ui/src/features/shell/viewer-shell.tsx`. Bridge/API changes live in
`apps/linux/src/services.rs`, `apps/server/src/catalog/viewer_state.rs`,
`apps/server/src/catalog/tracking.rs`, and the generated OpenAPI contract package.

## Actual verification

- `devenv shell -- pnpm --filter @nahhasio/linux-ui test:e2e work-page.spec.ts`: **23 passed**.
- Updated general client family-guide journey: **1 passed**.
- Linux suite excluding the two existing `sidebar-home-only` tests: **50 passed**.
  The unrestricted suite remains blocked by those stale home assertions: narrow search
  expects a dialog instead of its route, and wide home expects seven fixture cards instead
  of two. Their source was not changed to hide these unrelated failures.
- `devenv shell -- pnpm build`: passed for the TypeScript and Rust workspaces.
- `pnpm lint`, `pnpm typecheck`, `pnpm check:rust`: passed through devenv.
- Ordinary `cargo test --workspace --locked`: passed; explicit PostgreSQL integration tests
  remained ignored in this invocation. No tests targeted live catalog mutations.
- API contract tests: **5 passed**. Scoped Oxfmt and both Git diff whitespace checks passed.
- Required `pnpm check` stops at the unrelated formatting issue in
  `packages/cli/scripts/check-viewer-parity.mts`; subsequent checks were run independently.
- Final isolated GTK/WebKit harness: **176 scripted assertions passed** across desktop
  episodes, narrow episodes, hero and overview. Synthetic session and isolated mock API,
  zero mutations or unexpected routes; no production auth session used. Desktop/narrow
  tab and season scrolling, visible dialog headings, URL details, RTL navigation and
  overflow checks passed. Private screenshots/logs remain ignored in
  `data/previews/work-review/`.

## Performance and runtime limits

Removed full-viewport blur and episode backdrop filters. Viewer state uses memoized episode
lookups, discussion loads on demand, and relation previews require explicit intent. Earlier
same-native-harness blur comparisons showed less programmatic scrolling overhead without
blur, but these are not physical scrolling or compositor FPS guarantees.

The native harness reported EGL initialization failure and disabled hardware acceleration.
Its key events are synthetic, not trusted physical GTK input. GPU-backed smoothness and real
wheel/trackpad behavior remain unverified; do not claim the client is lag-free. Vite still
warns about the approximately 789 kB / 243 kB gzip client JS chunk.

`Unknown desktop command` was reproduced against an old running shell while newer UI assets
were loaded. Current binaries recognize `workState` and `workActivity`: no-session bridge
probes return `unauthorized`, not unknown-command, without HTTP or writes. The managed API was
restarted and reports ready. The ordinary GTK process was independently relaunched during
concurrent work; its executable inode is not readable through `/proc`, so the final native
checks certify the pinned private binary, not that process's in-memory executable.
If an already-open window still reports the old command error, fully quit and relaunch GTK;
launching another single-instance process alone only presents the existing window.

Native captures use the final `index-BFyBsfUi.js` bundle. Aqua's subsequent shared MediaCard
focus/private-badge adjustments were preserved, browser-tested and rebuilt as
`index-CiI6ziYT.js`; those two small adjustments were not recaptured in GTK.

No commits, migrations, live catalog mutation tests, player, torrent or download implementation
were performed. Stop here for Aqua's review.
