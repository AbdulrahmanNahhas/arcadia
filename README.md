# Arcadia

A personal, educational project — my own family's private media archive and torrent-backed
player, built to learn the stack (TanStack Start, Hono, Tauri, a real BitTorrent client embedded
in Rust) as much as to actually use. It is **not** a general-purpose media manager: the catalog
only ever holds what my family has actually chosen to watch and catalog by hand — editorial
scores, Arabic content notes, family-safety classifications — never an attempt at a complete
library of all movies or shows. Playback streams a torrent for the moment it's needed and expects
a family's *own* private Torrentio-compatible addon (see "Playback source" below); nothing here
hosts, indexes, or redistributes any media itself. Point it at your own server and your own
catalog if you use it — it is Arabic-first and RTL-first because that is what this family reads.

Arcadia v2 models titles as umbrella records with seasons, films, specials, and episodes
beneath them, then combines editorial scores, family-safety classifications, people, studios,
planets, and relationships in one searchable catalog.

Licensed MIT (see `LICENSE`) — the code, not any catalog data or artwork you populate it with,
none of which ships in this repository (see "Media storage" below).

The project is a pnpm monorepo:

```text
apps/api            Hono API and OpenAPI document
apps/web            React 19 and TanStack Start client (static SPA)
src-tauri           Tauri desktop shell — the torrent/mpv player, Linux-first
packages/cli        arcadia CLI, reads/writes the catalog straight against PostgreSQL
packages/contracts  shared Zod schemas and generated API types
packages/database   PostgreSQL schema, migrations, seed, and v1 importer
packages/domain     taxonomy, classification, policy, and scoring rules
packages/i18n       shared Arabic interface vocabulary and taxonomy labels
```

## Development

Arcadia targets Node.js 26. Enter the reproducible Nix environment and start PostgreSQL, the API
on port 23101, and the Tauri desktop app (see "Desktop (Tauri)" below):

```bash
devenv up
```

For browser-only work without the desktop shell, run the web dev server directly instead:
`devenv shell -- pnpm --filter @arcadia/web dev` (with `devenv up api` running alongside it).

`DATABASE_URL`, `VITE_API_URL`, the local Better Auth secret, and demo-seed flag are supplied
by `devenv.nix`. Browser routes use real cookie-backed sessions; the test-only identity bypass
is accepted only when both `NODE_ENV=test` and `ARCADIA_MOCK_AUTH=true`.

Database changes are explicit; startup never runs migrations automatically:

```bash
devenv shell -- pnpm db:generate
devenv shell -- pnpm db:migrate
devenv shell -- pnpm db:seed
```

In the development environment the seed creates three local accounts. They are fixtures for
manual testing and are never created unless `ARCADIA_SEED_DEMO_ACCOUNTS=true`:

| نوع الحساب | اسم المستخدم | كلمة المرور |
| --- | --- | --- |
| مالك العائلة | `admin` | `ArcadiaAdmin!2026` |
| عائلي | `family` | `ArcadiaFamily!2026` |
| شخصي | `personal` | `ArcadiaPersonal!2026` |

Set a unique `BETTER_AUTH_SECRET` and trusted `WEB_ORIGIN` outside development. Public account
registration is disabled: an owner creates an account directly or issues an expiring invitation.

### Playback source

The player finds torrents through the family's Torrentio-compatible Stremio addon. The API calls
it — never the desktop binary — so the URL stays out of anything shipped. Put these in the
repo-root `.env` (git-ignored):

| Variable | Meaning |
| --- | --- |
| `ARCADIA_STREAM_ADDON_URL` | Addon base URL, e.g. `https://nahhas-arcadia.family.fun`. Absent means playback reports "no source configured" rather than failing obscurely. |
| `ARCADIA_STREAM_ADDON_CONFIG` | Pipe-separated Torrentio options, e.g. `qualityfilter=cam,480p`. Pipes are encoded automatically. |
| `ARCADIA_STREAM_TIMEOUT_MS` | Upstream timeout (default `8000`). |
| `ARCADIA_STREAM_CACHE_TTL_MS` | In-process response cache (default 15 min), so two family members opening the same film make one addon call. |
| `ARCADIA_STREAM_PREFERRED_HEIGHT` | Preferred vertical resolution (default `1080`). Ranking prefers the best release at or below this and treats anything larger as a last resort — a 4K remux will not reach first frame quickly on a family connection. |
| `ARCADIA_STREAM_ALLOW_TMDB_IDS` | `true` lets `tmdb:` ids be sent when no IMDb id exists. Off by default until the addon is confirmed to accept them: a deployment that does not returns an empty list, which looks like "no sources" rather than "wrong id". |

### Subtitles

Subtitle search/download goes through OpenSubtitles' REST v1 API, called from `apps/api` only —
same reasoning as the addon URL above. A free key from
[opensubtitles.com/en/consumers](https://www.opensubtitles.com/en/consumers) goes in `.env`:

| Variable | Meaning |
| --- | --- |
| `OPENSUBTITLES_API_KEY` | Absent means the subtitle menu reports "no source configured"; playback itself is unaffected. |
| `OPENSUBTITLES_USER_AGENT` | Optional, defaults to `Arcadia v2`. |

### Media storage

Uploaded and ingested poster/banner/logo artwork lives on disk under `data/media/` by
default — outside the repo and outside `apps/web`, the same shape as a Jellyfin media
directory — and is served by the API itself at `/media/*`, not shipped as part of the web
build. `ARCADIA_MEDIA_ROOT` (and, if it should differ, `ARCADIA_PUBLIC_MEDIA_ROOT`) point it
elsewhere — a Docker volume, a NAS mount, wherever the deployment keeps media. `data/media/` is
git-ignored; nothing under it should ever be committed.

The active database is PostgreSQL and its migration history lives only in
`packages/database/drizzle/`. The single retained `data/arcadia.db` file is a read-only v1
recovery/import source. To rebuild a v2 catalog from it:

```bash
devenv shell -- pnpm db:import -- --dry-run
devenv shell -- pnpm db:import
devenv shell -- pnpm db:restore:legacy
```

The importer writes `migration-report.json` and never mutates the SQLite source.

## Desktop (Tauri)

`apps/web` builds as a static SPA (TanStack Start's `spa` mode — no server functions, no Node
runtime at request time; every call goes through `@arcadia/api` over HTTP) and `src-tauri/` wraps
that build as a native desktop app. `devenv up` starts PostgreSQL, the API, and `pnpm tauri dev`
together; run `devenv shell -- pnpm tauri dev` directly if you only want to (re)start the app
itself against an already-running API.

Linux/WebKitGTK-on-Wayland has a long-standing upstream DPI-scaling bug (misreported
`devicePixelRatio` — the app renders zoomed out, responsive breakpoints misfire, blur/animations
lag if you work around it with `WEBKIT_DISABLE_COMPOSITING_MODE`). `src-tauri/src/main.rs` fixes
this by forcing `GDK_BACKEND=x11` before GTK initializes — don't remove it without re-testing on
Wayland.

### Playback runtime

The embedded player links against **libmpv** and decodes in hardware where it can
(`vo=gpu-next`, `hwdec=auto-safe`). `devenv.nix` supplies `mpv`, `libGL`, `libva` and `libvdpau`
for development; on a plain distro the runtime needs them installed:

```bash
# Fedora
sudo dnf install mpv-libs libva libva-utils
# plus the driver for your GPU: intel-media-driver, libva-intel-driver, mesa-va-drivers (AMD),
# or nvidia-vaapi-driver
```

Verify hardware decode is actually active rather than assumed — the player logs a warning and
falls back to software decode instead of failing, so a silent pass is possible. `vainfo` should
list profiles, and the player reports `hwdec-current` (not `hwdec`, which only echoes what was
requested).

GStreamer packages are also in `devenv.nix`, and they are **not** for the player — mpv carries
its own ffmpeg. They are what WebKitGTK needs to play the YouTube trailer iframe on a work
detail page.

**Building a distributable bundle only works in CI, not on this NixOS dev machine.** Nix-built
binaries embed a `/nix/store/...` path as their ELF dynamic linker (`readelf -p .interp`) and
can't execute on a non-NixOS machine at all, and Tauri's own AppImage step downloads a generic
`linuxdeploy` binary that can't execute *on* NixOS either. `pnpm tauri build` therefore only
produces something runnable on a real standard-distro machine — locally, `pnpm tauri dev` is the
supported way to run the app; for an actual installable bundle, see "Releases and updates" below.

### Releases and updates

`.github/workflows/release.yml` builds the desktop bundle on `ubuntu-latest`, signs it, creates a
GitHub Release, and uploads the AppImage/deb/rpm plus a `latest.json` manifest. It runs on a
pushed `v*` tag, or manually (Actions → Release → Run workflow) against a tag that already exists.

```bash
git tag v0.2.0
git push origin v0.2.0
```

One-time setup, done outside git:

- Generate a signing keypair once (`pnpm tauri signer generate`), then add
  `TAURI_SIGNING_PRIVATE_KEY` (and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` if you set one) as repo
  secrets — Settings → Secrets and variables → Actions. The public half already lives in
  `src-tauri/tauri.conf.json`; **never commit the private half**.
- Add `ARCADIA_API_URL` as a repo **variable** (not a secret — it's just a hostname) set to your
  family server's real LAN/Tailscale address. The workflow bakes it into the build as
  `VITE_API_URL` and widens the app's CSP for that origin — the checked-in CSP only allows
  loopback, correct for local dev, wrong for a real deployment.

The running app checks `tauri.conf.json`'s configured `plugins.updater.endpoints` (GitHub
Releases' `latest.json`) from Settings → المظهر → التحديثات, and installs + restarts on confirm.
A release must be published (not a draft, not a prerelease) for the updater to ever find it —
`releaseDraft`/`prerelease` are both `false` in the workflow for exactly that reason.

## Self-hosting (Docker)

`docker-compose.yml` runs the database, the API, and a browsable (not playable — see "Playback
source"; torrent playback is desktop-app-only) copy of the web app, for a family's own server —
a home machine, a NAS, whatever stays on. LAN-only by design: nothing here is exposed to the
public internet, and there's no reverse proxy or TLS included.

```bash
cp .env.example .env   # fill in POSTGRES_PASSWORD, BETTER_AUTH_SECRET, ARCADIA_WEB_URL, VITE_API_URL
docker compose run --rm migrate   # first time, and after every schema change
docker compose up -d
```

`ARCADIA_WEB_URL`/`VITE_API_URL` both need your server's actual LAN address (e.g.
`http://192.168.1.50:23180` / `:23101`) — `VITE_API_URL` is baked into the web image at build time,
so rebuild it (`docker compose build web`) if that address ever changes. The desktop Tauri app is
a separate build entirely (see "Releases and updates" above) — this stack never plays anything
itself, it only serves the catalog.

## API and CLI

OpenAPI is available at `http://127.0.0.1:23101/openapi.json`.

`./bin/arcadia` reads and edits the catalog directly against PostgreSQL (no API server needed):

```bash
./bin/arcadia health
./bin/arcadia title list --search "monster" --limit 20
./bin/arcadia title get <title-or-alias>
./bin/arcadia stats coverage
./bin/arcadia work apply new-work.json --dry-run
./bin/arcadia help
```

Set `DATABASE_URL` to point at another database, and `ARCADIA_CLI_ACTOR` to attribute the
`audit_logs` rows it writes. Regenerate checked-in API types after changing the OpenAPI
contract:

```bash
devenv shell -- pnpm client:generate
```

Catalog, account, award, and social payloads are validated by the shared Zod schemas in
`packages/contracts`. Interface wording and common option labels live in `packages/i18n`; feature
components should not duplicate either set locally.

## Verification

Run the static checks, unit/integration tests, and production builds inside the Nix
environment. API and database integration tests expect the development PostgreSQL database
to be migrated and seeded.

`pnpm check` now covers the desktop shell too: it ends with `pnpm check:rust`
(`cargo fmt --check` plus `cargo clippy --all-targets -- -D warnings`). The Rust side is the
larger risk surface since the player landed, so it is no longer verified only by whether the app
happens to start.

```bash
devenv shell -- pnpm check
devenv shell -- pnpm test
devenv shell -- pnpm build
nix shell nixpkgs#chromium --command devenv shell -- pnpm test:e2e
```
