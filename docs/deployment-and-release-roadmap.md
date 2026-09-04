# Deployment, Media Storage, and Release Roadmap

> **Status:** Planning only — nothing in this doc is implemented yet. Written 2026-09-03 from a
> chat discussion; treat it the same way as `player-torrent-roadmap.md` (tick items as they land).
> **Scope for "real 1.0":** LAN-only. Remote access (Tailscale, etc.) and Phase 3's actual
> offline-video download are explicitly deferred past this doc.
> **§1 done (2026-09-03).** Both branches force-pushed to `origin` with clean history —
> `git filter-repo` needed two passes (the monorepo restructure meant older commits recorded these
> same files under a pre-`apps/web/` path, `public/media/...`, which the first pass's exact-path
> filter missed). `.git` went from 298 MB to 8.5 MB. A full pre-rewrite backup of the repo sits at
> `/home/aqua/Projects/personal/arcadia-backup-before-filter-repo` — safe to delete once you've
> confirmed GitHub looks right.
> **2026-09-04:** the two-device setup named concretely (§3.1/§3.2 — Fedora Silverblue as the only
> server, a NixOS laptop as a thin client, AppImage as the one artifact both currently run); the
> runtime-configurable API URL (§3, item 6) and the redefined per-title "save for offline" feature
> (§4, item 7) both built and closed out. Next concrete milestone: **v0.1.0** (§6, item 10) — the
> only remaining blocker is the one-time signing-key/secrets setup only the repo owner can do.

`origin` (`git@github.com:AbdulrahmanNahhas/arcadia.git`) read as having zero refs when this doc
was written; by the time §1 actually ran, both branches already existed there (their *original*
pre-cleanup state — pushed by something outside this conversation). That forced a
`git push --force-with-lease` to land the rewritten history, confirmed with the user first since
it overwrites remote history. Low risk: private, single-owner repo, and overwriting was the entire
point of doing this before anyone/anything else clones it.

---

## 1. Media storage — take images out of git

**Current state, more promising than it looks:** `apps/api/src/media-storage.ts` already reads
`ARCADIA_MEDIA_ROOT`/`ARCADIA_PUBLIC_MEDIA_ROOT` env vars and only falls back to
`apps/web/public/media/uploads` when they're unset. Half of "make it a folder, configure the path
somewhere" is already built — nobody has just pointed it anywhere else yet.

**The actual gap:** nothing serves media over HTTP independently of that folder being physically
inside the Vite-built web app. Today images work purely because `apps/web/public/*` gets copied
into both the web build's `dist/client` and the Tauri bundle's `frontendDist` — i.e. posters
currently ship *inside* the desktop app by accident of file layout, which is also (incidentally)
why they already work offline in the Tauri app today. Moving them out fixes the git problem but
means that offline property has to be rebuilt on purpose — see §4, which does exactly that.

**Plan (done):**

- [x] Point `ARCADIA_MEDIA_ROOT` at a path outside the repo — `data/media/uploads` by default
      (matching the existing gitignored `data/` convention), overridable for a Docker volume.
      Turned out to be three folders, not one: `apps/web/public/media/{uploads,entities,library}`
      plus two loose orphaned files (`orbital-archive.png`, `attack-on-titan-cover.jpg`, unreferenced
      by any code or `media_assets` row) — `entities`/`library` were a separate, older bulk-import
      path carrying the exact same kind of third-party artwork, just never routed through
      `media-storage.ts`'s helpers. All of it moved to `data/media/`; only
      `account-avatar-sprite.webp` stayed (a real static app asset, referenced by a literal path in
      `login-page.tsx`/`account-avatar.tsx`, not a DB `*Path` field).
- [x] Static route: `@hono/node-server/serve-static` mounted at `/media/*` in `apps/api/src/app.ts`,
      root = `getPublicMediaDirectory()`, unauthenticated (matching the zero-auth behavior these
      files already had as static Vite assets). Verified live — real file serves with correct
      content-type, a missing file 404s, `../` traversal 404s rather than escaping the root.
- [x] **No render call sites touched.** Instead of a `resolveMediaUrl()` helper at 15+ `<img src>`
      call sites, `apps/web/src/lib/api.ts`'s `apiFetch`/`client` — confirmed the one choke point
      every API call already passes through — rewrites any `*Path`-suffixed field pointing at
      `/media/...` into an absolute `${apiBaseUrl}` URL right there. Covers browser and Tauri alike;
      new `api.test.ts` pins the rewrite behavior.
- [x] `git rm -r --cached` the three folders + two files, `data/media/*` already covered by
      `.gitignore`. Two other hardcoded fallback paths found and fixed the same way:
      `packages/database/src/prepare-media-backfill.ts` and `packages/cli/src/commands/media.ts`.
- [x] `git filter-repo` (two passes — see the note above), then force-pushed. `.git`: 298 MB → 8.5 MB.

**New tech considered and rejected, on purpose:**

- *MinIO / self-hosted S3* — a real extra service to operate; only pays off with multi-server or
  geo-redundant storage. Not needed for one home server.
- *git-lfs* — doesn't answer "should this art ship in a public repo at all"; LFS objects still
  download for anyone who clones with LFS enabled.

Plain local disk + a Docker volume is the right amount of engineering here.

---

## 2. What's actually "on Docker"

```
docker-compose.yml
  db    postgres:17                          volume: pgdata
  api   build: apps/api                      env: DATABASE_URL, ARCADIA_MEDIA_ROOT=/data/media
                                              volume: media_data:/data/media
  web   nginx/Caddy serving apps/web's        build-arg: VITE_API_URL baked in
        prebuilt dist/client
  proxy (optional now, cheap to add later)   fronts web+api on one port —
                                              also what makes Tailscale-based remote
                                              access trivial to bolt on without re-architecting
```

Migrations stay an explicit, separate step (matches the existing "database changes are always
explicit" rule): `docker compose run --rm api pnpm db:migrate`, never automatic on container start.

**Fedora Atomic (Silverblue) note:** this whole stack runs on Podman unmodified —
`podman compose up -d` (or `podman-compose`), fully rootless. No `rpm-ostree` layering needed for
any server piece; that's only relevant to the desktop/player side (see the chat's earlier Silverblue
notes on the TV box itself).

---

## 3. "Is the DB always reachable so any device can see/play?" — yes, with one real gap

Confirmed: that's exactly the architecture already in place. `apps/api` + Postgres are the only
stateful pieces; any client that can reach that server's address sees the same catalog, accounts,
and playback history, because everything already lives server-side. Two things make that actually
work day-to-day:

- **A stable server address.** A DHCP reservation/static IP, or an mDNS name (avahi —
  `arcadia.local`) so it survives reboots without hunting for an IP.
- **Keep the browse/play asymmetry straight.** Browsing works from *any* client (browser or
  desktop) today. Playback (torrent + mpv) only works from the Tauri desktop app — a phone browser
  can browse the catalog but the play button stays disabled there until Phase 7 (Android). Nothing
  here changes that.

### 3.3 Ports moved off the defaults (2026-09-04)

Web dev/Tauri `devUrl` 3000, API 3001, Postgres (implicit default) 5432, and Docker's published
web port 8080 all moved to explicit, uncommon numbers — **23100** (web), **23101** (API),
**23102** (Postgres), **23180** (Docker web) — everywhere they're referenced (`devenv.nix`,
`tauri.conf.json`, `docker-compose.yml`, `.env.example`, both CI workflows, `playwright.config.ts`,
README/CLAUDE.md/AGENTS.md, and the CORS/auth/invite-link fallbacks in `apps/api` that had their
own separate `3000` defaults). Two real reasons, not just tidiness:

- A family server ends up running more than just Arcadia over time; 3000/3001/5432/8080 are
  exactly the ports other self-hosted things default to, so collisions were a when-not-if.
- **Fixes a real bug this session hit**, not a hypothetical one: with no explicit Postgres port,
  devenv's postgres landed on 5432 in one session and 5433 in the next (a leftover from a devenv
  version bump) — silent until a `pnpm test` run couldn't connect. `services.postgres.port` in
  `devenv.nix` pins it for good.

Chosen deliberately **below** 32768 — Linux's default ephemeral port range
(`net.ipv4.ip_local_port_range`, typically `32768–60999`) is where the kernel hands out ports for
*outgoing* connections; a persistent listening service sitting inside that range risks a rare bind
collision with some unrelated outgoing connection on the same box. 23100–23180 sits safely below it
and well above the well-known-ports range.

**Real gap worth closing regardless of Docker:** `VITE_API_URL` is a Vite build-time env var today,
so every device needs its own build if the server's address ever changes. For "any device on the
LAN," a small runtime-configurable API-URL setting (read once at app start, stored via Tauri's
store plugin or `localStorage`, falling back to the build-time value) means one build works
everywhere instead of a rebuild per device.

- [x] Runtime-configurable API base URL — a "عنوان الخادم" field in Settings (desktop-shell-only),
      backed by `localStorage` (same convention the theme preference already uses), applied via an
      app restart. **Real limitation, not fully solved:** the packaged app's CSP is widened for
      exactly one origin at *build* time (`release.yml`, from `ARCADIA_API_URL`) plus loopback —
      overriding to that same origin or to loopback works, overriding to a genuinely different,
      not-yet-authorized origin still gets silently CSP-blocked, since a webview's CSP can't be
      loosened at runtime. This setting covers "the server's address changed" (a new LAN IP), not
      "point this build at an unrelated server" — that still needs a rebuild.

### 3.1 The concrete two-device setup (2026-09-04)

Named explicitly because "any device" was still abstract until now:

- **Fedora Atomic (Silverblue)** — the family PC. The *only* stateful machine: Postgres + the API
  run here, in Podman (§2). Never runs a desktop build of its own unless it's also used to watch.
- **NixOS laptop** — where Arcadia is developed, and also just a thin client at runtime: no
  database, no API, nothing stateful. Installs the desktop app like any other device and points
  it at the Silverblue box's address.

Both machines are Linux, but *differently* enough that it changes which build artifact is useful:

| Target | Fits Silverblue? | Fits NixOS? | Verdict |
| --- | --- | --- | --- |
| **AppImage** | Yes — no install step, no `rpm-ostree` layering needed | Yes — the one format that needs nothing NixOS-specific at all | **The one artifact both machines can run unmodified.** Already what `release.yml` builds. |
| `.rpm` | Yes, natively (`dnf install` or `rpm-ostree install`, the latter needs a reboot) | No — NixOS has no `dpkg`/`rpm` as its package manager | Nice-to-have on the Silverblue box specifically (native menu entry, clean uninstall); irrelevant on the laptop. |
| `.deb` | No | No | Not a target for either current machine. |
| `.exe` / `.dmg` | N/A | N/A | Real future targets (`tauri-action` supports both) once Windows/macOS machines exist to test on. macOS additionally needs code-signing/notarization to avoid Gatekeeper friction — more setup than Linux, genuinely fine to defer. |

**So: right now, download the AppImage on both machines.** One build, `chmod +x`, run — no
distro-specific step on either side.

### 3.2 "Download once, connect to the DB" — confirmed, and two *separate* update paths

The desktop app never bundles a database or the API; it is a pure client. Install it once per
device, point it at the Silverblue box's LAN address (baked in at build time today — §3's
`VITE_API_URL` gap — but since every current device is on the same home network hitting the same
address, one build already serves both machines without that gap being blocking).

Updating the **app** and updating the **server** are unrelated mechanisms — don't conflate them:

- **The desktop app** self-updates via the Tauri updater already wired (`tauri-plugin-updater` +
  GitHub Releases' `latest.json`) — each installed copy, on whichever device, checks and updates
  itself independently. Nothing to do with Podman or the server.
- **The server** (Postgres + API, only ever on the Silverblue box) updates by deploying a new
  container image — a start-simple, upgrade-later choice:
  - **Now:** `git pull && podman compose up -d --build` by hand (or a small systemd timer running
    it) — zero extra infrastructure.
  - **Later, if that gets tedious:** `podman auto-update` — Fedora ships a
    `podman-auto-update.timer` out of the box; label the containers, publish images to a registry
    (GitHub Container Registry via a CI job), and Podman checks for a newer tag and redeploys on
    its own. The idiomatic Podman-native answer, but it needs a registry-publish step in CI first
    that doesn't exist yet — not worth building before the manual path has actually been felt as
    annoying.

**Docker/Podman's scope stays exactly §2 — server only.** The desktop app is never containerized:
it needs direct display/GPU access for the video surface and hardware decode, which a container
can't sensibly provide, and there is exactly one delivery mechanism for it (a native installer per
platform), completely separate from the container delivery mechanism the server uses.

---

## 4. Save for offline (per-title metadata + images — not offline video)

**Redefined 2026-09-04** from an earlier, vaguer "cache whatever was recently viewed" sketch into
what was actually asked for: an explicit, per-title **save** action, not a generic cache.

- A user saves a title (a show or a film) from the desktop app. That fetches and persists, on
  *that device*, just that title's metadata (description, scores, episode list, content warnings)
  and its images (poster/banner/logo) — not the whole catalog, only what was explicitly saved.
- With the server unreachable, opening the app still shows every saved title in full — poster,
  description, scores — because that data now lives on the device itself, independent of any live
  fetch.
- **Playing** a saved title still needs a live connection exactly as today (the API resolves a
  torrent, then the torrent itself needs peers) — saving is deliberately *not* a video download.
- This is smaller than and independent of **Phase 3** in `player-torrent-roadmap.md`
  (download-to-local, which fetches the actual video file for true offline *playback*) — saving
  ten shows' metadata costs zero video bytes; downloading an episode is a separate action a user
  takes per-episode, on top of having saved the show. See the disambiguation note Phase 3 now
  carries.

### Design — done (2026-09-04)

Built smaller than first sketched, on purpose, once the actual pieces were in hand:

- [x] **Server:** no new table — `account_title_states` already existed (favorite/personal
      rating/notes, one row per account+title) and was exactly the right shape. Added one column,
      `saved_offline boolean not null default false` (migration `0022_charming_rogue.sql`),
      deliberately independent of `is_favorite` — favoriting is an editorial signal, saving means
      "keep available offline"; a title can be either, both, or neither. Threaded through the
      already-existing `GET /api/v1/me/library` (now also lists a saved-but-not-favorited title,
      and returns `savedOffline`) and `PUT /api/v1/me/library/:titleId` (accepts `savedOffline`
      alongside the existing fields) — no new routes needed.
- [x] **Persistence: IndexedDB, not a Tauri filesystem API, on both platforms.** The original
      sketch assumed `app_data_dir()` for desktop and IndexedDB for browser as two separate code
      paths; building it revealed IndexedDB alone covers both (the Tauri webview supports it
      fine), so `features/library/offline-store.ts` needed zero Tauri-specific code at all — a
      title's detail JSON keyed by id, plus every `*Path` image it references fetched and stored
      as a `Blob` keyed by URL, reusing the exact same "walk the JSON for `*Path` fields" pattern
      `rewriteMediaUrls` (`lib/api.ts`) already established. Reading a saved title back swaps each
      cached image in as a fresh `blob:` URL (`URL.createObjectURL`) — the stored JSON keeps the
      real server URLs, correct for what a live fetch would have returned, but useless as an
      `<img src>` with nothing reachable to load them from.
- [x] **Offline read path:** `lib/api.ts`'s `getTitle` — the one function every title-detail load
      already went through — falls back to the local copy only when `fetch` itself throws
      (offline, DNS failure, connection refused), never when the server answers with a real error
      (404, 500, a validation failure). One choke point, no route-loader-level branching needed.
- [x] **UI:** a bookmark-style button beside the existing favorite heart on the title page
      (`work-detail-page.tsx`), and a "غير متصل — من المحفوظات" badge shown whenever
      `navigator.onLine` is false (a `useIsOnline` hook, same hydration-safe
      `useSyncExternalStore` pattern as `useIsDesktopShell`).
- [ ] **Not yet:** a save affordance on catalog cards (title page only for now — cards are a
      cheap follow-up once the underlying mutation already exists); a dedicated "المحفوظات" list
      view (today "saved" titles surface through the existing `/me/library` list alongside
      favorites, without their own filtered view); and actually consuming the *fact* of a save
      across devices — saving on device A makes it offline-available on device A only right now,
      the server-side flag exists but nothing yet auto-syncs a save into device B's IndexedDB.

**Rejected for this design:** a generic "cache the last N titles you viewed" (TanStack Query
persister) — it was the original sketch here, but it caches whatever you *happened* to browse, not
what you *chose* to keep, which is a worse fit for "I want this show available even if I haven't
opened it in a month." An explicit save is simpler to reason about and to build.

---

## 5. Public repo, releases, future `.apk`

**Done (2026-09-03).** Repo is public, MIT-licensed (`LICENSE`, `Cargo.toml`, root
`package.json`). `.github/workflows/tauri-build.yml` was replaced outright rather than extended —
`tauri-apps/tauri-action` (the official action) builds, signs with the updater's minisign keypair,
creates the GitHub Release, and generates `latest.json` in one step, which a hand-rolled
`softprops/action-gh-release` addition would have had to reimplement piece by piece. Now
`.github/workflows/release.yml`, tag-triggered (`v*`) or manual. See README's "Releases and
updates" for the one-time secret/variable setup it depends on
(`TAURI_SIGNING_PRIVATE_KEY`/`_PASSWORD`, `ARCADIA_API_URL`).

- [x] License: MIT.
- [x] Release workflow: build + sign + release + `latest.json`, in `release.yml`.
- [x] **Auto-update:** `tauri-plugin-updater` + `tauri-plugin-process` wired end to end —
      `tauri.conf.json`'s `plugins.updater` points at
      `https://github.com/AbdulrahmanNahhas/arcadia/releases/latest/download/latest.json`, and a
      small settings-page card (desktop-shell-only) checks, downloads, installs, and relaunches.
      The self-hosted-manifest idea from the original draft of this section never ended up
      necessary — GitHub Releases' own generated manifest was simpler once public was decided.
- [x] **Found and fixed along the way:** the checked-in CSP (`connect-src`/`media-src`/`img-src`)
      only allowed loopback origins — correct for local dev against `127.0.0.1`, but it would have
      silently blocked every request once a real build pointed at a family server's LAN address.
      `release.yml` widens it at build time via `TAURI_CONFIG` (merged over `tauri.conf.json` by
      the Tauri CLI itself), computed from the same `ARCADIA_API_URL` that becomes `VITE_API_URL`.
- [ ] Future Android (`.apk`): Phase 7 of `player-torrent-roadmap.md` already scopes this
      (`pnpm tauri android init` + androidx.media3). Once it lands, `release.yml` gains an Android
      build job uploading `.apk`/`.aab` alongside the Linux bundles — the pipeline shape already
      fits it, nothing to prep now.

---

## 6. Concrete order of operations before "real 1.0" (LAN-only)

1. [x] Decide a license — MIT.
2. [x] Media migration: `ARCADIA_MEDIA_ROOT` outside the repo, API `/media` static route,
   the `apiFetch`/`client` rewrite in the web app, `git rm --cached` the tracked folders.
3. [x] `git filter-repo` to strip old media blobs from history (two passes — see §1's note).
4. [x] Pushed to GitHub, and the repo is public.
5. [x] Docker Compose stack (db/api/web + volumes) + a "Self-hosting (Docker)" section in README.
   Not build-tested inside actual Docker/Podman — no container runtime is available in this
   environment; `pnpm deploy --prod --legacy` (the piece `apps/api/Dockerfile` leans on) was
   verified standalone instead — built, deployed, booted with production env vars, real `200` from
   `/api/v1/health`. Run `docker compose build` as the first real check.
6. [x] Runtime-configurable API URL (§3) — done, with the CSP caveat noted there (only helps
   within an already-authorized origin; a genuinely different server still needs a rebuild).
7. [x] Save for offline — per-title metadata + images (§4) — done; catalog-card affordance and
   a dedicated saved-titles view are cheap, not-yet-built follow-ups (see §4's "Not yet").
8. [x] GitHub Releases wired (`release.yml`, via `tauri-apps/tauri-action`) — see §5.
9. [x] `tauri-plugin-updater` pointed at Releases — see §5.
10. [ ] **v0.1.0 release** — the actual milestone the rest of this list is building toward. Blocked
    on the one-time setup only the repo owner can do (README's "Releases and updates"): generate
    the signing keypair, add `TAURI_SIGNING_PRIVATE_KEY`/`_PASSWORD` as repo secrets and
    `ARCADIA_API_URL` as a repo variable, then `git tag v0.1.0 && git push origin v0.1.0`.
11. [ ] Install the release build (the AppImage) on both the Silverblue box and the NixOS laptop;
    run the still-outstanding Phase 1 acceptance pass from `player-torrent-roadmap.md` (10-film
    sample, real hardware-decode confirmation) — the first real-hardware milestone, same one
    flagged earlier.
12. [ ] Phase 3 (download-to-local, real offline video) whenever ready — explicitly out of scope
    for this pass.
