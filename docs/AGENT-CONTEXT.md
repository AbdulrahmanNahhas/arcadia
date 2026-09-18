# AGENT-CONTEXT — the map for v0.3.5 work

> **Purpose:** every fact an AI agent otherwise re-derives by searching the tree. Read this file
> first in every session that touches v0.3.5 work; read [`v0.3.5.md`](./v0.3.5.md) for *what* to
> do and *why*. **Keep this file true**: when a phase moves, splits, or deletes a file listed
> here, update the line in the same commit. Never paste plan text here — link to the plan.
>
> **Who edits what:**
> - `v0.3.5.md` — tick boxes, set phase status, add findings under §1 only with `path:line`
>   evidence. Do not rewrite decisions already made; add a dated note if one changes.
> - `AGENT-CONTEXT.md` (this file) — paths, versions, commands, gotchas, measured numbers.
> - `CLAUDE.md` / `AGENTS.md` — only for durable conventions that outlive this release; keep the
>   two byte-identical apart from the title line.
> - Memory (`~/.claude/.../memory/`) — only for things about the *user*, not the code.

Last verified: 2026-09-18 after Phases S/O/P3 (self-hosting, offline, downloads) and the 0.3.5 release.

---

## 1. Environment facts

| Thing | Value |
| --- | --- |
| Node | `nodejs_26` from `devenv.nix`; the sandbox shell outside devenv has Node 24 — fine for scripts, use `devenv shell --` for anything touching Postgres/Tauri |
| Package manager | pnpm workspace (`apps/*`, `packages/*`) |
| Python | **not installed** — write one-off scripts as `node file.mjs` |
| Database | PostgreSQL on `127.0.0.1:23102/arcadia` (`DATABASE_URL` from devenv) |
| API | Hono on `http://127.0.0.1:23101` (`VITE_API_URL`) |
| Web dev server | Vite on `127.0.0.1:23100`; Tauri `devUrl` points at it |
| Desktop | Tauri 2.11 (`src-tauri/`), WebKitGTK 4.1, GTK 3 via `gtk`/`gdk`/`gdkx11` 0.18 crates, libmpv2 6, librqbit 9 |
| Dev machine | NixOS, Wayland (Niri); the shell forces `GDK_BACKEND=x11` → runs under XWayland |
| Web stack | React 19.2, TanStack Router 1.170 / Start 1.168 / Query 5.102 (see A9 for pins), Tailwind 4, shadcn on Base UI 1.6, Phosphor icons, Zod 4 |
| Lint/format | Biome (authoritative), oxlint + local `anti-slop` plugin (`tools/oxlint/anti-slop/`) |
| Tests | Vitest 4 (`*.test.ts(x)` beside units), Playwright in `apps/web/tests/*.spec.ts` |
| Desktop data (Linux, id `com.arcadia.desktop`) | downloads `~/Videos/Arcadia/<title>/` (configurable), registry `~/.local/share/com.arcadia.desktop/downloads.json`, torrent resume `…/torrent-session/`, IndexedDB + localStorage in the WebKitGTK profile under the same dir, stream cache `~/.cache/com.arcadia.desktop/streams` (wiped every launch) — full table in README "Where Arcadia keeps data" |
| Family server (Fedora Atomic) | rootless Podman Quadlet: units in `~/.config/containers/systemd/`, env `~/.config/arcadia/arcadia.env`, media `~/arcadia/media`, backups `~/arcadia/backups`, Postgres in the `arcadia-pgdata` volume; images `ghcr.io/abdulrahmannahhas/arcadia-{api,web}` |
| Docker on the laptop | daemon works but only outside the sandbox and only with `--network=host` (the host resolver is loopback-only); `docker build --network=host -f apps/api/Dockerfile .` |
| Versions | `Cargo.toml`/`tauri.conf.json` carry the release version (0.3.5); root `package.json` stays `2.0.0` (it names the v2 line) |

## 2. Commands that matter (all from repo root)

```bash
pnpm check                      # oxlint → biome → tsc (all packages) → cargo fmt+clippy
pnpm typecheck                  # tsc only; fastest signal after a refactor
pnpm --filter @arcadia/web test # vitest for the web app
pnpm --filter @arcadia/web typecheck
pnpm build                      # all packages; web → apps/web/dist/client (Tauri frontendDist)
devenv shell -- pnpm client:generate   # after any packages/contracts change that touches the API shape
devenv shell -- pnpm tauri dev         # the desktop shell against the running API
devenv up                              # postgres + api + tauri dev
biome format --write <paths>           # format only what you touched
docker build --network=host -f apps/api/Dockerfile -t arcadia-api:check .   # server images (see §1)
docker run --rm --network=host -e DATABASE_URL=postgresql://aqua@127.0.0.1:23102/<db> arcadia-api:check node dist/migrate.js
NODE_ENV=test devenv shell -- pnpm --filter @arcadia/api exec vitest run src/features/downloads   # session-backed API tests
# On the Fedora box (README "Self-hosting"): systemctl --user {start,status} arcadia-{db,api,web,migrate}
```

- `pnpm check` runs `cargo clippy -D warnings` — Rust warnings fail the build.
- Playwright needs Chromium from Nix: `nix shell nixpkgs#chromium --command devenv shell -- pnpm test:e2e`.
- `pnpm tauri build` does **not** produce a runnable bundle on NixOS (Nix ELF interpreter path);
  only CI does. Test the shell with `tauri dev`.

## 3. Where things live

### Web (`apps/web/src`)

| Path | Role | Notes |
| --- | --- | --- |
| `routes/*.tsx` | file-based routes | `routeTree.gen.ts` is generated — never edit. Routes: `/`, `/browse`, `/titles/$titleId`, `/titles/$titleId/installments/$installmentId`, `/player/$installmentId`, `/archive`, `/awards`, `/awards/$organizationSlug`, `/_entities/*`, `/compare`, `/profiles`, `/settings`, `/accounts`, `/admin/*`, `/login`, `/invite/$token`, `/offline`, `/offline/$titleId` |
| `routes/__root.tsx` | document shell | theme restore script, `DirectionProvider rtl`, `SpatialNavigationRoot`, `AuthBoundary` |
| `router.tsx` | `getRouter()` | QueryClient (staleTime 30 s), `defaultPreload: "intent"`, SSR-query integration (inert under spa mode) |
| `styles.css` | Tailwind 4 entry | `@custom-variant dark`, `@theme inline` tokens, light `:root` + `.dark` palettes, base layer, focus rules (368 lines) |
| `lib/api.ts` | `apiFetch` + typed `openapi-fetch` client | always `credentials: "include"` |
| `lib/auth-client.ts` | Better Auth client | `authClient.useSession()` |
| `lib/theme.ts` | **(A3)** `useTheme`, `resolveTheme`, storage key `arcadia:theme` | the only file allowed to touch the theme key / `html.dark` |
| `lib/use-persisted-state.ts` | localStorage state hook | |
| `server/*.ts` | *not* server functions — plain fetch wrappers | `compat.ts` (713 lines) = v1 `Work` shape adapter, **to be deleted (E2)** |
| `features/accounts/` | `api.ts` (`accountKeys`, `useCurrentAccount`), `auth-boundary.tsx`, login/invite pages | |
| `features/platform/` | Home, browse (`database-page.tsx`), detail (`work-detail-page.tsx`, 2454 lines), entities pages, `spatial-navigation.tsx` (the D-pad engine to be replaced in Phase C), `components/` (work-card, rails, platform-shell, global-search) | |
| `features/archive/` | My Space (`archive-hub-page.tsx`), `api.ts` (`archiveKeys`) | duplicates three Platform rails — E4 |
| `features/library/` | `player/` (see below), compare, offline, `model.ts` (v1 types, dies with compat) | player lifecycle/IPC is the best-engineered code in the repo; don't rewrite it |
| `features/library/downloads/` | `api.ts` (Tauri bridge + one process-wide snapshot store, `useDownloads`, `startDownload` with sidecar subtitles), `download-button.tsx`, `downloads-page.tsx` (`/downloads`), `mirror.ts` (best-effort `/me/downloads` sync, mounted in `PlatformShell`) | desktop-only; renders nothing / an empty state in a browser |
| `features/library/playback-resolver.ts` | `resolvePlayback`: **local download first** (`LocalLookup`, injectable), then cached candidates, then the API | `noLocalLookup` for callers that must hit the network |
| `features/library/player/` | `player-page.tsx` composes only; `hooks/` (`use-player-session` lifecycle+IPC, `use-player-actions` transport, `use-player-shortcuts` keyboard/D-pad model, `use-overlay-regions` X11 cut-outs, `use-controls-visibility`, `use-progress-persistence`, `use-playhead-paint`), `components/` (top bar, control bar, timeline, mobile transport, overlays), `panels/` (`panel-shell` modal + D-pad walk; tracks, subtitles, speed, source, episodes, more), `languages.ts` (flags/labels/aliases), `track-groups.ts` (group-by-language + show-all), `episodes.ts` | every panel is a `PanelShell`; every focusable control carries `data-player-control` and sits in a `data-control-row`; anything drawn over the picture carries `data-video-overlay` |
| `features/admin/` | `admin-shell.tsx` (role gate), `pages/`, `components/editor-form/` (2434 lines), `json-editor/` | |
| `features/profiles/` | `settings-page.tsx` (theme UI at the "appearance" tab), `profiles-page.tsx` | |
| `features/social/`, `features/awards/`, `features/catalog/`, `features/entities/` | as named | |
| `components/ui/` | vendored shadcn (Base UI) — 32 primitives incl. `sidebar`, `command`, `chart` | do not hand-edit; add via the `shadcn` skill |
| `components/patterns/` | **does not exist yet** — Phase E3/F1 creates it | |
| `public/media/` | static art, `<slug>-<kind>-<hash>.<ext>` | |

### API (`apps/api/src`)

| Path | Role |
| --- | --- |
| `app.ts` (2112 lines) | one `OpenAPIHono`; mounts `features/{accounts,archive,awards,social,titles}/routes.ts` plus many inline routes; auth middleware; admin audit middleware |
| `repository.ts` (675) | `browse()` (JS pagination — D1a), `titleDetail()` (N+1 — D1c), visibility helpers |
| `auth.ts` | Better Auth server + `isTestAuthBypass()` (never weaken) |
| `features/accounts/routes.ts` | `/api/v1/me` GET/PATCH; `defaultPreferences` at line ~43; `account_preferences` upsert at ~282 |
| `features/downloads/routes.ts` | `/api/v1/me/downloads` GET/PUT/DELETE — mirror of each device's registry (`account_downloads`, migration 0028); plain session routes, not in OpenAPI |
| `migrate.ts` | `dist/migrate.js`: media backfill pass + `runMigrations()` — the container migration entry |
| `integrations/` | tmdb, anilist, fanart, opensubtitles, torrent-source |
| `media-storage.ts` | sha256 content-addressed uploads |

### Packages

| Path | Role |
| --- | --- |
| `packages/contracts/src/index.ts` (1137) | all Zod schemas; `accountPreferencesSchema` ~line 497 (`theme` enum lives here) |
| `packages/contracts/src/generated.ts` | OpenAPI types — regenerate, never edit |
| `packages/database/src/schema.ts` (1530) | Drizzle schema; `account_preferences.theme` is `text` default `'dark'` (no DB enum → adding a theme value needs **no migration**) |
| `packages/database/drizzle/` | the only migration history (latest `0028_windy_marvel_zombies`, `account_downloads`) |
| `packages/database/src/{client,media-backfill,run-migrations}.ts` | `createDatabase`, `prepareMediaBackfill` (was the top-level `prepare-media-backfill.ts` script), `runMigrations` (drizzle-orm migrator, same journal/table as drizzle-kit) |
| `deploy/quadlet/`, `deploy/systemd/`, `deploy/arcadia.env.example` | Fedora Atomic units + backup timer + env template; `docker-compose.yml` runs the same images for Docker hosts |
| `.github/workflows/publish-images.yml` | GHCR images on push to master / `v*` tags |
| `packages/domain/` | classification, policy, scoring, taxonomy — framework-free |
| `packages/i18n/` | Arabic/English labels; under-used (F4) |
| `packages/cli/` | `./bin/arcadia` — direct Postgres access, `--json` output |

### Desktop (`src-tauri`)

| Path | Role |
| --- | --- |
| `tauri.conf.json` | window 1280×800, min 960×600, CSP, updater, bundle deps. `transparent` — see A8 |
| `src/main.rs` | forces `GDK_BACKEND=x11`, strips `WAYLAND_DISPLAY` (needed for mpv XID embedding) |
| `src/lib.rs` | `AppState`, all `player_*` commands, torrent session in `setup`, shutdown on close |
| `src/player/mod.rs` | `MpvEngine` (libmpv2), 4 Hz event tick over a `Channel<PlayerEvent>` |
| `src/player/surface.rs` | native X11 child window **above** the webview, shaped with cut-outs for controls; the doc comment at the top explains the Tauri widget-tree constraint — read it before touching GTK |
| `src/torrent/` | librqbit session + axum stream server; persistence now under `app_data_dir()/torrent-session`; video extension allowlist (`downloads::registry::is_allowed_video`); `stop_stream_keeping_files` for promotion |
| `src/downloads/{mod,registry}.rs` | `DownloadManager` (queue of 3, 1 Hz snapshot channel, `reconcile()` on launch, `finish_stream` promotion) + the JSON registry; commands `downloads_*`, `player_load_path` in `lib.rs` |

## 4. Gotchas (things that cost a session to rediscover)

- **`spa` mode.** `vite.config.ts` builds a static SPA (`spa: { enabled: true }`). No
  `createServerFn`, no server routes — they'd work in the browser and break the Tauri build.
- **Theme.** Source of truth is `html.dark` + `html.style.colorScheme`, set by the inline restore
  script in `__root.tsx` before first paint, then by `lib/theme.ts`. Tailwind's `dark:` variant is
  `&:is(.dark *)` — anything with `.dark` on `<body>` or above makes light mode impossible (that
  was bug A1).
- **Admin gate.** `/api/v1/admin/*` requires `owner`/`editor`; the web side gates in
  `routes/admin.tsx` `beforeLoad` (A7) and again in `admin-shell.tsx`.
- **Session on the client.** `authClient.useSession()` (Better Auth) for "is anyone logged in";
  `useCurrentAccount()` (`/api/v1/me`, key `accountKeys.current`) for role/preferences.
- **Query keys.** Factories exist for `accountKeys`, `archiveKeys`, `socialKeys`; everything else
  is inline strings until Phase G. Don't add new inline keys.
- **RTL.** `<html dir="rtl">` + Base UI `DirectionProvider`. Use logical utilities (`ps-`, `ms-`,
  `start-`, `end-`), never `pl-`/`left-` for layout.
- **Fonts.** Loaded: Noto Kufi Arabic (headings), Noto Sans Arabic (body). `--font-mono` is
  JetBrains Mono (A5). Do not add font packages without importing them in `styles.css`.
- **Blur.** `backdrop-blur` is fine on fixed chrome, expensive on scrolling content, and must be
  absent under the future `tv:` variant.
- **Artwork chips.** Elements sitting on posters/banners intentionally use `black`/`white`
  utilities regardless of theme. They carry `data-on-artwork` (A4). Grep for it before
  "fixing" them.
- **Player.** `player/hooks/use-playhead-paint.ts` uses refs + rAF for the playhead and a Rust-side
  4 Hz tick. Don't convert it to state. `body.arcadia-player-open` paints the body opaque black.
  Panels are opaque (`bg-neutral-900`) on purpose — the X11 surface cannot blend, so there is no
  glass over the video. The spatial-navigation engine `preventDefault`s Enter/arrows window-wide,
  so player key handling clicks focused controls itself (`use-player-shortcuts.ts`,
  `panel-shell.tsx`). `GET ./subtitles?languages=all` lifts the ar/en default filter.
- **Core dumps.** `core.*` in the repo root are gitignored crash dumps from the Tauri shell.
  Delete them; investigate with Phase T1.
- **Generated files.** `routeTree.gen.ts`, `contracts/src/generated.ts` — regenerate, never edit.
- **No Python** in the sandbox; `node -e`/`.mjs` for scripts. `$TMPDIR` for temp files.
- **`pnpm check` is a real gate now** (0 oxlint / 0 biome errors as of 2026-09-14) — *except*
  inside the **Phase E legacy allowlist** in `oxlint.config.ts` `overrides`: the oversized files E
  splits or deletes have the anti-slop rules and `react/set-state-in-effect` relaxed. The list only
  shrinks. When you replace one of those files, delete it from the list in the same commit and
  make the replacement lint clean. Never add a file to it.
- **Lint/typecheck/test tools run without devenv**: `./node_modules/.bin/{oxlint,biome,tsc,vitest}`
  from the repo root (`tsc -p tsconfig.json --noEmit` inside each package). Only Postgres-backed
  tests, `pnpm build`, `client:generate`, cargo, and the Tauri shell need `devenv shell --`, and
  devenv needs the sandbox off for `~/.cache/nix`.
- **TS target is ES2023** (`tsconfig.base.json`) — `toSorted`, `findLast`, etc. are available
  everywhere; `unicorn/no-array-sort` expects `toSorted`.
- **Tauri diagnostics**: `--devtools` / `ARCADIA_DEVTOOLS=1`, `ARCADIA_LOG=info` prints startup
  milestones (`src-tauri/src/diagnostics.rs`, README "Diagnostics").
- **Router context.** `router.tsx` passes `{ queryClient }`; `__root.tsx` uses
  `createRootRouteWithContext`. Guards/loaders read `context.queryClient`.
- **Downloads share the stream session.** Adding a torrent that is currently streaming returns
  `AlreadyManaged`; the manager queues it under `promotions` and `finish_stream` (called from
  `player_stop`) moves the pieces and re-adds it in the download folder. Never call
  `transfers.stop_stream()` directly from a command path that could carry a promotion.
- **Web image is address-free.** `VITE_API_URL=same-origin` → `apiBaseUrl = window.location.origin`;
  nginx proxies `/api`, `/media`, `/openapi.json` to `ARCADIA_API_UPSTREAM`. Do not reintroduce a
  build-arg address. The desktop app still needs a real URL (settings override / `ARCADIA_API_URL`).
- **Quadlet quoting.** `Exec=` lines are systemd command lines: `$$` for a shell `$`, `%%` for a
  literal `%`. `.timer` files go to `~/.config/systemd/user/`, not the Quadlet folder. Bind
  mounts need `:Z` on Fedora (SELinux).
- **JS `String.replace` with a string replacement expands `$$`, `$&`, `$\``** — when scripting
  doc edits with node, pass a function (`s.replace(a, () => b)`). This file was duplicated once
  by exactly that.
- **Router error boundaries** receive `error: unknown` (`ErrorComponentProps`); narrow with
  `instanceof Error` at the call site — the anti-slop plugin forbids `unknown` parameters and
  `typeof` narrowing in helpers.

## 5. House rules for this release

1. **No file over 500 lines** for new/split code (E). Generated files, `*.test.ts`,
   `components/ui/sidebar.tsx`, and `schema.ts` (pending decision) are exempt.
2. **Delete, don't deprecate.** Dead code is removed in the same PR that makes it dead.
3. **One implementation per pattern** (F1). Before writing a header/empty state/card/rail, look
   in `components/patterns/`; if it's missing, create it there, not in a feature.
4. **Route files are thin**: `validateSearch`, `beforeLoad`, `loader`, component import.
5. **Query keys only in `features/<name>/api.ts`.**
6. **Semantic tokens only** — no hex, no `bg-white`/`text-black` outside `data-on-artwork`.
7. **Motion**: opacity/transform, `--selection-duration`/`--selection-ease`; respect
   `prefers-reduced-motion` (already globally handled in `styles.css`).
8. **Verify before handoff**: `pnpm check`, relevant tests, `pnpm build`. Say what you ran.
9. **Conventional Commits**, one phase item or one coherent slice per commit.
10. **Budget-aware execution.** Mechanical phases (splits, renames, lint sweeps, string
    extraction) are run as Sonnet 5 subagents on *disjoint directories* with a written brief
    (see the lint sweep: a brief file + one agent per directory, no commits, report back).
    Opus 5 plans, reviews the diff, and commits. Parallel agents must never share a file.

## 6. Measured numbers (fill in as phases land)

| Metric | Baseline (date, commit) | Current |
| --- | --- | --- |
| Web entry chunk (uncompressed) | 416 KB (2026-09-09, `9952cc7`) | 422 KB (2026-09-13, Phase A) |
| Stylesheet | 284 KB | 291 KB (JetBrains Mono `@font-face` rules added) |
| Largest route chunk | `work-detail-page` 132 KB (+ recharts 336 KB) | |
| Tauri cold start → first paint | *unmeasured* (T1) | |
| Tauri cold start → home interactive | *unmeasured* (T1) | |
| `/api/v1/titles?limit=24` server time | *unmeasured* (D1) | |

## 7. Phase log

| Date | Phase | What landed | By |
| --- | --- | --- | --- |
| 2026-09-18 | S, O, P3, release 0.3.5 | Security/debrid doc; address-free web image + bundled migrate entry + Node 26 Dockerfile fix + GHCR workflow; Quadlet units, backup timer, Fedora migration guide; download engine (Rust) + `/downloads` UI + local playback + `account_downloads` (0028); on-disk locations doc; `ci.yml` on master; version bump | Opus 5 |
| 2026-09-14 | Lint | 481 → 0 oxlint errors (65 by four Sonnet agents before a rate limit, the rest by one Sonnet agent + Opus); Phase E allowlist introduced; TS target ES2023 | Opus 5 + Sonnet 5 |
| 2026-09-13 | T2 | `diagnostics.rs`: devtools switch, log level, startup milestones (`df56ea8`) | Opus 5 |
| 2026-09-13 | A | A1–A7, A9 landed (theme fix + `system`, `lib/theme.ts`, black/white audit with `data-on-artwork`, JetBrains Mono, core dumps, admin `beforeLoad`, pinned TanStack). A8 applied, awaiting manual player check. | Opus 5 |
