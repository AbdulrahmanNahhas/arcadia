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

**Real gap worth closing regardless of Docker:** `VITE_API_URL` is a Vite build-time env var today,
so every device needs its own build if the server's address ever changes. For "any device on the
LAN," a small runtime-configurable API-URL setting (read once at app start, stored via Tauri's
store plugin or `localStorage`, falling back to the build-time value) means one build works
everywhere instead of a rebuild per device.

- [ ] Runtime-configurable API base URL, with the current build-time value as the default.

---

## 4. New feature: offline catalog + images (not offline video)

Scoped precisely to what was asked: browsing (titles, images, scores, episode lists) should keep
working with no reachable server; playback still needs the live API + torrent path exactly as
today. This is smaller and different from **Phase 3** in `player-torrent-roadmap.md`
(download-to-local, which caches the actual video file for offline *playback*) — that phase is
untouched by this.

- [ ] Persist the TanStack Query cache (already the web app's data layer) via
      `@tanstack/query-persist-client-core` + IndexedDB — survives reloads, serves the last-known
      catalog the instant the network fails, refreshes quietly once reachable again.
- [ ] Tauri desktop reuses the same code path — its webview supports IndexedDB fine, no separate
      implementation needed.
- [ ] Once media is served from the API (§1), add a cache-first fetch strategy for `/media/*` — a
      service worker covers the browser (and turns the web app into an installable PWA, a free
      win for phones with no native app yet); the Tauri app can rely on the same
      Cache-Control-driven HTTP cache from the new API media route.
- [ ] Small "غير متصل — آخر بيانات محفوظة" (offline — last saved data) indicator when serving from
      cache instead of a live fetch. The play button's existing failure states already handle "no
      reachable source" gracefully — nothing new needed there.

---

## 5. Public repo, releases, future `.apk`

Confirmed workable now that media is coming out of git (§1) and history gets cleaned before the
first push — no copyright-redistribution or personal-data concern left in the code itself.

- [ ] **Pick an actual license before going public** — `src-tauri/Cargo.toml` currently says
      `UNLICENSED`, which on a public repo reads as "all rights reserved, don't reuse this." That
      may be exactly what's wanted, or not — a real decision, not one to default silently.
- [ ] Extend the existing `tauri-build.yml` (already builds AppImage/deb/rpm) to attach those
      artifacts to a GitHub Release on a `v*` tag push (`softprops/action-gh-release`, a few lines).
- [ ] **Auto-update, revised now that public + Releases is on the table:** point
      `tauri-plugin-updater` directly at the GitHub Releases manifest. The earlier "self-host a
      tiny update manifest" idea only made sense under a private repo — moot now.
- [ ] Future Android (`.apk`): Phase 7 of `player-torrent-roadmap.md` already scopes this
      (`pnpm tauri android init` + androidx.media3). Once it lands, the same release workflow
      gains an Android build job uploading `.apk`/`.aab` alongside the Linux bundles — the
      pipeline shape already fits it, nothing to prep now.

---

## 6. Concrete order of operations before "real 1.0" (LAN-only)

1. [ ] Decide a license (§5 — your call, still open).
2. [x] Media migration: `ARCADIA_MEDIA_ROOT` outside the repo, API `/media` static route,
   the `apiFetch`/`client` rewrite in the web app, `git rm --cached` the tracked folders.
3. [x] `git filter-repo` to strip old media blobs from history (two passes — see §1's note).
4. [x] Pushed to GitHub (`git push --force-with-lease`, both branches). **Still manual:** flipping
   the repo's actual visibility to public is a GitHub settings action this environment has no
   `gh` auth to do — do that in the GitHub UI whenever ready (no code/git step needed).
5. [ ] Docker Compose stack (db/api/web + volumes) + a "self-hosting" section in README.
6. [ ] Runtime-configurable API URL (§3) so one build serves every device on the LAN.
7. [ ] Offline catalog + image cache (§4).
8. [ ] Wire GitHub Releases into `tauri-build.yml`; tag `v0.1.0`.
9. [ ] `tauri-plugin-updater` pointed at Releases.
10. [ ] Install the release build on the Fedora TV box; run the still-outstanding Phase 1
    acceptance pass from `player-torrent-roadmap.md` (10-film sample, real hardware-decode
    confirmation) — the first real-hardware milestone, same one flagged earlier.
11. [ ] Phase 3 (download-to-local, real offline video) whenever ready — explicitly out of scope
    for this pass.
