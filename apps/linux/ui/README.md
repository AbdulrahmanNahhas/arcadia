# Nahhasio viewing interface

Independent React/Vite/TypeScript UI hosted by our GTK4/WebKitGTK shell. This is a family library viewer; the administration dashboard stays in `apps/web`.

## Design contract

The reviewed Stremio screenshots guide the navigation rail, prominent search, artwork shelves and discovery preview. The catalog itself supplies the visual emphasis. Palette: ink `#11111d`, native rail `#0d0e18`, panel `#191a2c`, control surface `#232438`, lavender `#aa9aff`, readable text `#f2f1fa`. Self-hosted IBM Plex Sans Arabic provides the display/body voice; system fonts supply compatible fallback. Original English titles keep their natural direction.

Home opens with up to ten latest-added public works in an artwork-led rotating hero. It uses
real banner/logo assets, metadata and summary, with direct slide selection, previous/next and
pause controls. Rotation pauses on hover/focus and respects reduced motion. Details open the
existing work preview; playback remains disabled. Latest updates and public planet shelves use
bounded queries. Browse offers explicit private-work inclusion.

Aqua's newer UI request is tracked in [the review checklist](../../../docs/linux-ui-review-tasks.md).
One checkpoint is implemented and reviewed at a time: H01 hero, then shared scored work/installment
cards, selected-planet shelf, family comments, anticipated installments, full filters and work
pages. Remaining native scroll/keyboard improvements have their own acceptance checks.

Discovery requests another page only on explicit intent. The selected-work preview has overview,
family guide and data tabs and adapts to narrow widths. The upcoming full work page will replace
that limited presentation after review. Player/download/saved controls remain disabled.

## Boundary

UI never owns a bearer token or directly accesses the server. `src/lib/bridge.ts` permits only the agreed typed catalog/auth commands, validates native replies and parses catalog data through `@nahhasio/api-contract` schemas. Rust retains the session token in memory. Reloading the interface can recover the native in-memory session; closing the application ends that local session. No browser/localStorage persistence.

Development origin: `http://127.0.0.1:23110`. Production uses bundled Vite files with relative asset paths. Opening this UI in an ordinary browser cannot sign in; the native connection is required. Browser tests install an explicitly isolated bridge fixture to verify UI behavior, while native/server integration is checked separately.

Run `pnpm --filter @nahhasio/linux-ui dev`, `build`, `typecheck` or `test:e2e` in the project devenv shell. The root environment owns native startup and backend readiness.
