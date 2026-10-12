# Nahhasio client interface

Independent React/Vite/TypeScript UI with TanStack Router and Query packaged by the GTK4/WebKitGTK shell. The client owns
presentation; native Rust owns session secrets, HTTP, libmpv and device transfer/storage.
Administration currently lives in `apps/web`; Aqua wants its workflows in an administrator-only
client area after the Tailwind/shadcn foundation checkpoint.

## Current presentation

Preserve the reviewed Arabic RTL navigation rail, search, artwork shelves, work pages and purple
palette. Original titles keep their natural direction. Current features include bounded discovery,
work data, personal state, releases, Watch, playback controls and the device download queue.
See [the review queue](../../../docs/linux-ui-review-tasks.md) and
[player evidence](../../../docs/linux-player-checkpoint.md) for behavior and remaining limits.

Tailwind 4 and official shadcn Base UI Nova controls are installed. RTL uses DirectionProvider;
CSPProvider disables injected style blocks. `src/styles/tailwind.css` owns imports, fonts and
semantic tokens. Page/player presentation uses static Tailwind utilities; the separate player
stylesheet has been removed. Runtime planet palettes bind validated CSS variables. Native
player sliders retain their draft/cancel behavior through Base UI.

Aqua requested the full official Base UI Nova component set; it is available in `components/ui`.
Add/update official components through the shadcn CLI. Both application/component utility aliases
resolve to `@/lib/utils`. Do not hand-edit vendored primitives or weaken packaged CSP to fix callers.

## Routes and skills

`src/routes` owns small TanStack file routes, generated into `src/routeTree.gen.ts`; never edit
the generated tree. Hash history preserves packaged navigation. Router context and
QueryClientProvider share one QueryClient; features retain their typed bounded query factories.
The Vite plugin splits route components automatically.

Read `.agents/skills/nahhasio-desktop-ui/SKILL.md` from the repository root, then the shadcn and
TanStack Router/Query guides. TanStack Start guidance applies only to `apps/web`.

## Native boundary

The UI holds no bearer/admin token and never accesses the server directly. `src/lib/bridge.ts`
validates bounded native replies and parses API models through `@nahhasio/api-contract`.
Rust retains session secrets in memory. Reloading can recover that native session; closing the
application ends local ownership. There is no browser/localStorage session persistence.

Development origin is exactly `http://127.0.0.1:23110`; production uses contained
`nahhasio://app/` files and relative assets. Ordinary browser login requires the native connection;
browser tests install isolated bridge fixtures. Native integration is verified separately.

## Commands

Run through `devenv shell --` outside the project shell:

```sh
pnpm --filter @nahhasio/linux-ui dev
pnpm --filter @nahhasio/linux-ui build
pnpm --filter @nahhasio/linux-ui typecheck
pnpm --filter @nahhasio/linux-ui test
pnpm --filter @nahhasio/linux-ui test:e2e
pnpm --filter @nahhasio/linux-ui test:e2e:player
```

Client browser journeys serve a production bundle on `23110`. Player journeys use the single
`playwright.player.config.ts` and isolated Vite fixture entry on `23112`; the fixture config
needs no bridge-export workaround. Browser checks do not prove GTK physical input or rendering.
The root environment owns native startup and Rust API readiness.
