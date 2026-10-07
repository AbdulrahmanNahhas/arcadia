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

If the shell crashes it leaves an ELF core dump (`core.<pid>`, hundreds of MB) next to the
directory it was launched from — usually the repo root under `devenv up`. They are gitignored;
delete them (`rm core.*`) and, if they keep appearing, inspect the latest one with
`gdb -c core.<pid>` to find the faulting library before filing it under `docs/v0.3.5.md` Phase T.

### Diagnostics

The shell has two launch-time switches that work in release builds too (`src-tauri/src/diagnostics.rs`):

| Switch | Effect |
| --- | --- |
| `--devtools` or `ARCADIA_DEVTOOLS=1` | opens the WebKit inspector on the main window once the page has loaded |
| `ARCADIA_LOG=trace\|debug\|info\|warn\|error\|off` | log level (release default `warn`, debug default `info`) |

At `info` the log prints startup milestones as `+<ms>` since process start (`setup`, `page load
started`, `page loaded`) — the cold-start number `docs/v0.3.5.md` Phase T1 asks for.

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

### Where Arcadia keeps data on your device

Nothing is hidden inside the app bundle; every byte the desktop app keeps is a plain file under
one of these directories (Linux paths; the Tauri identifier is `com.arcadia.desktop`):

| What | Where | Lifetime |
| --- | --- | --- |
| **Downloaded videos** (Downloads page) | `~/Videos/Arcadia/<title>/…` by default — change it from التنزيلات → تغيير المجلد. Subtitles sit beside each video as `<name>.ar.srt` / `<name>.en.srt`. | Yours; only "إزالة وحذف الملف" removes them |
| Download registry (what is kept, where, state) | `~/.local/share/com.arcadia.desktop/downloads.json` | With the app data |
| Torrent resume state for unfinished downloads | `~/.local/share/com.arcadia.desktop/torrent-session/` | Deleted when a download finishes or is removed |
| Saved titles (metadata + posters, "احفظ دون اتصال") | The WebKitGTK profile under `~/.local/share/com.arcadia.desktop/` (IndexedDB database `arcadia-offline`) | Until unsaved from the title/card/My Space |
| Session token, server address, theme, device name | `localStorage` in the same profile (`arcadia:*` keys) | Until sign-out / reset |
| Streaming cache (the film being watched right now) | `~/.cache/com.arcadia.desktop/streams/` | Wiped when playback stops and on every launch |
| Downloaded subtitle files for streams | `~/.cache/com.arcadia.desktop/subtitles/` | Cache |
| Crash dumps | `core.<pid>` next to the launch directory | Delete them (see "Desktop (Tauri)") |

In a plain browser (`pnpm dev`, or the web container) the saved-titles store and the `arcadia:*`
keys live in that browser's own profile; downloads are desktop-only. On the server, artwork is
`~/arcadia/media` and the database is the `arcadia-pgdata` volume (see "Self-hosting").

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

## Self-hosting on Fedora Atomic (Podman + Quadlet)

The family server owns PostgreSQL, the API, and the artwork; every other machine (the NixOS
laptop, a TV box) runs the desktop app and points it at the server. On Fedora Atomic (Silverblue,
Kinoite, …) the whole server side runs **rootless Podman via Quadlet** — systemd units the
system already knows how to start at boot, restart, and auto-update — pulling the images CI
publishes to GHCR. No package layering, no Node, no repo checkout on the server. The unit files
live in [`deploy/quadlet/`](deploy/quadlet); [`deploy/systemd/`](deploy/systemd) holds the
backup timer; [`deploy/arcadia.env.example`](deploy/arcadia.env.example) is the one config file.
Rationale and the security model are in [`docs/security-and-debrid.md`](docs/security-and-debrid.md).

LAN-only by design: nothing here is exposed to the public internet and there is no reverse proxy
or TLS. Ports: **23101** (API — what the desktop app talks to), **23180** (a browsable web copy;
playback stays desktop-only). Postgres is never published.

### 1. Export from the laptop (`devenv up`)

With `devenv up` still running (Postgres on `127.0.0.1:23102`), from the repo root:

```bash
mkdir -p ~/arcadia-export
devenv shell -- pg_dump -h 127.0.0.1 -p 23102 -Fc arcadia > ~/arcadia-export/arcadia.dump
tar czf ~/arcadia-export/media.tgz -C data media          # posters/banners/logos
```

Copy both to the server (replace `server` with its LAN address or SSH alias):

```bash
ssh server mkdir -p arcadia/media arcadia/backups .config/arcadia .config/containers/systemd .config/systemd/user
scp ~/arcadia-export/arcadia.dump ~/arcadia-export/media.tgz server:arcadia/
scp deploy/quadlet/* server:.config/containers/systemd/
scp deploy/systemd/*.timer deploy/systemd/*.service server:.config/systemd/user/
scp deploy/arcadia.env.example server:.config/arcadia/arcadia.env
```

### 2. Prepare the server (once)

On the Fedora box, as the user that will own the containers (not root):

```bash
tar xzf ~/arcadia/media.tgz -C ~/arcadia && rm ~/arcadia/media.tgz   # -> ~/arcadia/media/{uploads,entities,library}
chmod 600 ~/.config/arcadia/arcadia.env
nano ~/.config/arcadia/arcadia.env   # POSTGRES_PASSWORD (twice: also inside DATABASE_URL),
                                     # BETTER_AUTH_SECRET (openssl rand -base64 32),
                                     # ARCADIA_WEB_URL=http://<LAN IP of this box>:23180, API keys
loginctl enable-linger "$USER"       # user services start at boot, without a login session
sudo firewall-cmd --permanent --add-port=23101/tcp --add-port=23180/tcp && sudo firewall-cmd --reload
systemctl --user daemon-reload       # Quadlet turns the .container/.volume/.network files into units
systemctl --user enable --now podman-auto-update.timer   # nightly `podman auto-update` (AutoUpdate=registry)
systemctl --user enable --now arcadia-backup.timer       # nightly pg_dump into ~/arcadia/backups
systemctl --user enable --now arcadia-restore-drill.timer  # weekly proof the dumps restore (see §5)
```

Give the box a stable address (a DHCP reservation on the router, or a static IP): the desktop
app remembers it.

**Image visibility.** GHCR packages a workflow creates start out *private*. Either make
`arcadia-api` and `arcadia-web` public once (GitHub → your profile → Packages → package →
Package settings → Change visibility) — no login needed on the box, nothing in the images is
secret — or log the box in with a classic token that has `read:packages`:
`podman login ghcr.io -u AbdulrahmanNahhas` (Podman stores it for the auto-update timer too).

### 3. Restore the catalog and start

```bash
systemctl --user start arcadia-db
podman exec -i arcadia-db pg_restore -U arcadia -d arcadia --no-owner --no-privileges < ~/arcadia/arcadia.dump
systemctl --user start arcadia-migrate      # applies any migration newer than the dump; safe to re-run
journalctl --user -u arcadia-migrate --no-pager | tail -5   # expect "Database is up to date."
systemctl --user start arcadia-api arcadia-web
curl -s http://127.0.0.1:23101/api/v1/health   # {"status":"ok",...}
```

For a *fresh* server with no dump, skip `pg_restore`, run `arcadia-migrate`, then create the
owner account with the CLI over an SSH tunnel (below) or by seeding.

`systemctl --user status arcadia-db arcadia-api arcadia-web` shows the stack;
`journalctl --user -u arcadia-api -f` follows the API log. Because the units are
`WantedBy=default.target`, a reboot brings everything back on its own.

### 4. Point the desktop app at it

Settings → عنوان الخادم (desktop shell only) → `http://<server LAN IP>:23101` → the app reloads
against the server. Every device does this once; a release build also takes the address at build
time from the `ARCADIA_API_URL` repo variable (see "Releases and updates") so new installs land
there by default. Browsers on the LAN can use `http://<server LAN IP>:23180` to browse.

### 5. Day-to-day: updating, schema changes, and developing on the laptop

- **Code changes** keep flowing from the laptop: `devenv up` still runs its own local Postgres
  and API for development; push to `master` and [`publish-images.yml`](.github/workflows/publish-images.yml)
  builds `ghcr.io/abdulrahmannahhas/arcadia-{api,web}:latest`. The server picks them up on the
  next `podman-auto-update` run, or right away with `podman auto-update`. Pin
  `Image=...:v0.3.5` in the unit if you would rather update by hand (`systemctl --user daemon-reload
  && systemctl --user restart arcadia-api` after editing).
- **Schema changes** (a new file under `packages/database/drizzle/`) are never applied
  automatically. After the image updates: `systemctl --user start arcadia-migrate`. The API keeps
  serving in the meantime; run it promptly, since new code may expect the new columns.
- **Backups** land in `~/arcadia/backups/arcadia-<date>.dump` nightly (14 kept). Artwork is plain
  files in `~/arcadia/media`. Restore:
  `podman exec -i arcadia-db pg_restore -U arcadia -d arcadia --clean --if-exists --no-owner < file.dump`.
- **Restore drill** (`arcadia-restore-drill`, weekly): a backup you have never restored is a
  hope, not a backup. Every Sunday the drill restores the newest dump into a throwaway database
  inside the same Postgres container, counts the titles, drops it, and logs
  `restore drill OK`. If it ever fails, the nightly dumps are not restorable — fix that before
  you need them. Enable it once: `systemctl --user enable --now arcadia-restore-drill.timer`;
  check with `journalctl --user -u arcadia-restore-drill`.
- **Off-site copy** (`arcadia-offsite`, nightly): the dumps live on the same SSD as the
  database, so a dead drive takes both. Plug in a USB drive (or mount a NAS), write its path to
  `~/.config/arcadia/offsite.env` as `ARCADIA_OFFSITE_DIR=/run/media/<user>/<drive>/arcadia`,
  copy `deploy/systemd/arcadia-offsite.{service,timer}` to `~/.config/systemd/user/`, and
  `systemctl --user enable --now arcadia-offsite.timer`. It rsyncs `backups/` and `media/`
  there every night and quietly skips when the drive is not mounted.
- **Postgres memory** is set in `arcadia-db.container` (`Exec=postgres -c shared_buffers=256MB …`)
  for a 4–8 GB box; raise `shared_buffers`/`effective_cache_size` proportionally on a bigger
  one, then `systemctl --user daemon-reload && systemctl --user restart arcadia-db`.
- **Working against the server from the laptop** (CLI, psql, pulling the live catalog into the
  dev database): Postgres is not on the LAN on purpose — open a tunnel and use `DATABASE_URL`:

  ```bash
  # once, on the server: add `PublishPort=127.0.0.1:5432:5432` to arcadia-db.container,
  # then `systemctl --user daemon-reload && systemctl --user restart arcadia-db`
  ssh -N -L 25432:127.0.0.1:5432 server &
  DATABASE_URL=postgresql://arcadia:<password>@127.0.0.1:25432/arcadia ./bin/arcadia stats coverage
  ```

  or simply take the latest backup dump and `pg_restore` it into the laptop's devenv database
  (`devenv shell -- pg_restore -h 127.0.0.1 -p 23102 -d arcadia --clean --if-exists --no-owner file.dump`).
- **Docker instead of Podman:** `docker-compose.yml` runs the same images with the same
  env names (`cp .env.example .env`, `docker compose run --rm migrate`, `docker compose up -d`).

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
