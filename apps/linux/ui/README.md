# Nahhasio viewing interface

Independent React/Vite/TypeScript UI hosted by our GTK4/WebKitGTK shell. This is a family library viewer; the administration dashboard stays in `apps/web`.

## Design contract

The reviewed Stremio screenshots guide the navigation rail, prominent search, artwork shelves and full work pages. The catalog itself supplies the visual emphasis. Palette: ink `#11111d`, native rail `#0d0e18`, panel `#191a2c`, control surface `#232438`, lavender `#aa9aff`, readable text `#f2f1fa`. Self-hosted IBM Plex Sans Arabic provides the display/body voice; system fonts supply compatible fallback. Original English titles keep their natural direction.

Home opens with up to ten latest-added public works in an artwork-led rotating hero. It uses
real banner/logo assets, metadata and summary, with direct slide selection, previous/next and
pause controls. Rotation pauses on hover/focus and respects reduced motion. Details open a full work page; playback remains disabled. Latest updates and one selected-planet
shelf use bounded queries. Family comments/reviews and anticipated installments complete home.
Browse offers explicit private-work inclusion and clears planet context when entered from the rail.

Aqua's newer UI request is tracked in [the review checklist](../../../docs/linux-ui-review-tasks.md).
One checkpoint is implemented and reviewed at a time: H01 hero, then shared scored work/installment
cards, selected-planet shelf, family comments, anticipated installments, full filters and work
pages. Remaining native scroll/keyboard improvements have their own acceptance checks.

Discovery requests another page only on explicit intent. A work has its own content-area page
with overview, family, installments/episodes and data tabs. Back/Escape return to the preserved
library scroll/focus. The exhaustive work-data inventory and deep linking remain future work.
Player/download/saved controls stay disabled. Cards share one component for works/installments
and use server-calculated scores verified against the dashboard, with null scores kept unrated.

## Shared controls

Tailwind CSS 4 is integrated through the Vite plugin. Official shadcn Base UI controls live in
`src/components/ui`; add/update them with the CLI rather than editing vendored primitives.
`src/styles/tailwind.css` maps their semantic colors to the viewing palette. Media cards remain
app-specific. RTL comes from Base UI's DirectionProvider. CSPProvider disables injected style
blocks; the packaged CSP remains unchanged. Browser journeys now run the production bundle,
including dropdown positioning, selection, Escape/focus return and responsive sidebar layout.

All viewing-interface layout and appearance use Tailwind utilities in the components. The old
`viewer.css` and `home-shell.css` stylesheets are removed. `src/styles/tailwind.css` contains only
Tailwind imports, font registrations and shared theme tokens; do not add page selectors or
`@apply` component styles. Runtime catalog colors may be bound as CSS custom-property values,
with Tailwind utilities owning their presentation.

The sidebar owns navigation, search (Ctrl+K, including Arabic keyboard layouts) and the account
control pinned at the bottom. There is no top navbar; page content uses the full available height.
Future page redesigns are separate review checkpoints.

## Boundary

UI never owns a bearer token or directly accesses the server. `src/lib/bridge.ts` permits only the agreed typed catalog/auth commands, validates native replies and parses catalog data through `@nahhasio/api-contract` schemas. Rust retains the session token in memory. Reloading the interface can recover the native in-memory session; closing the application ends that local session. No browser/localStorage persistence.

Development origin: `http://127.0.0.1:23110`. Production uses bundled Vite files with relative asset paths. Opening this UI in an ordinary browser cannot sign in; the native connection is required. Browser tests install an explicitly isolated bridge fixture to verify UI behavior, while native/server integration is checked separately.

Run `pnpm --filter @nahhasio/linux-ui dev`, `build`, `typecheck` or `test:e2e` in the project devenv shell. The root environment owns native startup and backend readiness.
