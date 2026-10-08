# Nahhasio viewing interface

Independent React/Vite/TypeScript UI hosted by our GTK4/WebKitGTK shell. This is a family library viewer; the administration dashboard stays in `apps/web`.

## Design contract

The reviewed Stremio screenshots guide the navigation rail, prominent search, artwork shelves and discovery preview. The catalog itself supplies the visual emphasis. Palette: ink `#11111d`, native rail `#0d0e18`, panel `#191a2c`, control surface `#232438`, lavender `#aa9aff`, readable text `#f2f1fa`. Self-hosted IBM Plex Sans Arabic provides the display/body voice; system fonts supply compatible fallback. Original English titles keep their natural direction.

Home shelves are bounded real catalog queries: recently updated, animation by release year, live action by release year. No fabricated popularity, streaming availability or viewing history. Discovery combines server filters and sorting and requests another page only on explicit user intent. A selected work opens a detail preview with overview, family guide and data tabs. At narrow widths that preview takes the available content area; the poster grid and shelf sizes adapt rather than scaling a fixed canvas. New player/download/saved controls remain disabled.

## Boundary

UI never owns a bearer token or directly accesses the server. `src/lib/bridge.ts` permits only the agreed typed catalog/auth commands, validates native replies and parses catalog data through `@nahhasio/api-contract` schemas. Rust retains the session token in memory. Reloading the interface can recover the native in-memory session; closing the application ends that local session. No browser/localStorage persistence.

Development origin: `http://127.0.0.1:23110`. Production uses bundled Vite files with relative asset paths. Opening this UI in an ordinary browser cannot sign in; the native connection is required. Browser tests install an explicitly isolated bridge fixture to verify UI behavior, while native/server integration is checked separately.

Run `pnpm --filter @nahhasio/linux-ui dev`, `build`, `typecheck` or `test:e2e` in the project devenv shell. The root environment owns native startup and backend readiness.
