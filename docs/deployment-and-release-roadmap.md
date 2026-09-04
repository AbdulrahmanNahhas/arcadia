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
> server, a NixOS laptop as a thin client, AppImage as the one artifact both currently run), and §4
> redefined from a generic view-history cache into an explicit per-title "save for offline"
> feature. Next concrete milestone: **v0.1.0** (§6, item 10).

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

### Design

- [ ] **Server:** a new `account_saved_titles` table (`account_id`, `title_id`, `saved_at`) —
      small, additive, syncs the *fact* of having saved something across every device the account
      uses, even though the cached bytes themselves stay local per device. `GET`/`POST`/`DELETE`
      under `/api/v1/me/saved-titles` or similar, visibility-checked the same way every other
      title read already is (`visibleTitleIdsForAccount`).
- [ ] **Desktop persistence:** on save, fetch the title's detail payload and its poster/banner/logo
      bytes, write them into the Tauri app's own storage (`app_data_dir()` — a *kept*, backed-up-
      worthy directory, unlike the streaming cache's disposable `app_cache_dir()`). A small local
      index (title id → detail JSON + image paths) is enough; no need for a local database engine.
- [ ] **Offline read path:** the web app's data layer tries the live API first: on failure (not
      merely slow — genuinely unreachable), fall back to the local saved-title store for any title
      id that has one. A saved title renders fully offline; an unsaved one shows the existing
      network-error state, unchanged.
- [ ] **UI:** a "حفظ" (save) affordance on the title page and on catalog cards, a "المحفوظات"
      (saved) library view that works with zero network, and a small "غير متصل — من المحفوظات"
      (offline — from your saved copy) indicator when a title is rendering from the local store
      instead of a live fetch.
- [ ] Browser build: same save action, backed by IndexedDB instead of Tauri's filesystem API —
      the same code path both platforms already share for other Tauri-guarded features
      (`isDesktopShell()`-style branching at the storage layer only, not the UI).

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
6. [ ] Runtime-configurable API URL (§3) so one build serves every device on the LAN — still open,
   not blocking (both current devices share one home network and one build).
7. [ ] Save for offline — per-title metadata + images (§4, redefined 2026-09-04) — still open.
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
