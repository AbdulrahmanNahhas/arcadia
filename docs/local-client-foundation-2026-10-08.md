# Local server and Linux client foundation — 2026-10-08

Aqua authorized dashboard organization plus three concurrent tasks: minimal authentication,
client API, and the Kotlin/Compose Linux client. The family PC runs Fedora Atomic with Podman
and an existing Jellyfin installation. Finish local integration first; SSH and deployment follow
review of the local result. This checkpoint does not claim torrent/download completion.

## Organization and cleanup

The dashboard's crowded folders were grouped by workflow. Thin route entries still compose the
same feature pages, and reusable headers/tables/notices moved into `components/dashboard`.

```text
apps/web/src/features/
  auth/
  artwork/library/
  catalog/{works,entities}/
  dashboard/{home,shell}/
  database/{data,records,schema,validation,revisions,overview}/
  editor/{work,fields,references,artwork,structure,json/{document,tree}}/
  scoring/
  server/overview/
```

Moved 87 source/assets/test files and updated their imports, including browser-test imports.
Removed the unused standalone artwork search panel and old work-template JSON file. The Hono
API and historical references remain because active dashboard/provider/CLI modules still rely
on their behavior. Retire each with its last real consumer; do not discard migration history or
recovery data as source cleanup. Start server functions now use the current `.validator()` API.

## Authentication and API

Rust login verifies existing Better Auth credential hashes with the exact scrypt/NFKC behavior.
V1 currently accepts existing active owner identities. Sessions expire after seven days, are
revocable, and store a token digest in the existing session table. No signup, profile selector,
password reset, or schema migration is introduced. Login hashing/concurrency and attempts are
bounded. Suspensions and bans are checked. Broader client roles require content-policy handling.

The dashboard bridges login through TanStack Start, uses an HttpOnly same-site cookie, checks
origins on mutations, redirects logged-out users, and verifies owner sessions before database
operations. Existing loopback/debug-only private administration safeguards remain. It is not yet
a production/LAN administration deployment.

`packages/api-contract/openapi.json` defines versioned authentication, works list/detail, filters,
and registered artwork endpoints. Its generator produces Kotlin serializable models and a
TypeScript client with generated Zod response validation from the same contract. Generated source
is never edited by hand. Pagination/filter/sort operate in SQL. Detail responses include the
current work structure and editorial information. Playback/source resolution remains pending.

## Linux client

`apps/linux` is a working JVM Compose Desktop/Gradle project with real login, paginated browsing,
search/filter/sort, generated contract decoding, authorized artwork, work/episode details, and
local-file playback through external mpv. Tokens remain in memory; credential persistence is later
work. HTTP is allowed only for loopback; another PC requires HTTPS. There is no administration UI.

The player uses a private IPC socket and cleans up on close. Save, stream and download controls
remain disabled until their services exist. A manually selected file is not yet automatically
matched to a work or episode. Torrent playback, Jellyfin source resolution, downloads, saved packs,
playback progress, and offline synchronization remain the next functional milestones.

The project devenv now supplies JDK 21, Gradle, mpv, Compose runtime libraries, and Chromium for
browser verification. Runtime startup currently reports graphics/font warnings and falls back
when an OpenGL context cannot be created; full desktop visual/GPU verification remains needed.

## Verification

Verified so far: repository lint, formatting, TypeScript checks and Rust Clippy passed; Rust's
10 tests passed; dashboard's 17 model/auth-policy tests passed. The Kotlin compile and runnable
JAR packaging passed. Real API/client checks on the restored `nahhasio_client_test` database
passed login, catalog pagination/filter/detail, real artwork decoding and logout/revocation.
A temporary video/Arabic subtitle exercise verified mpv IPC commands and cleanup.

All 29 final browser journeys passed, including logged-out redirection, actual disposable-owner
sign-in/logout, sidebar routes and hidden installment/episode URLs, catalog filters/sorting,
selection, JSON/editor behavior, artwork and mobile layouts. Repeated hard reloads of Vite's
unbundled modules exhausted Chromium resources; a private trace identified
`net::ERR_INSUFFICIENT_RESOURCES`. Route coverage now follows normal sidebar navigation with
separate direct-load checks and retains runtime-error assertions. Provider-dialog behavior uses
a deterministic fixture rather than an upstream call. The controlled fixture server stays alive
for its test run and is terminated afterward. Disposable DB/session/credential files were removed.

Final `pnpm check` and `pnpm build` passed after the expanded API work. Registered artwork was
explicitly checked for HTTP 200, correct image MIME and nonempty bytes; unauthenticated requests
returned 401. No provider success or hosted-server deployment is inferred from these checks.

Do not infer a deployed or torrent-capable product from successful compile or local-file checks.

## Next work

1. Review the desktop UI and first catalog contract; refine incomplete catalog fields/facets.
2. Design source/file identity and playback resolution, including the matching downloaded-file
   preference and explicit torrent versus Jellyfin availability.
3. Add release-date/provider episode previews, merges, provenance and corrections so weekly
   episode/status maintenance is reduced without overwriting editorial fields.
4. Inventory obsolete schema/data access and rehearse needed migrations on restored copies.
5. Extract/package the Rust media core, prove torrent playback and subtitles on the real desktop,
   then add persistent server/device download recovery and saved metadata packs.
6. Add playback progress and offline sync, then prepare Fedora Atomic/Podman deployment and
   connect the existing Jellyfin over an authenticated local-network entry point.

## Resumed work and design review

After the account limit interruption, Aqua requested a local admin account and rejected the
plain Material 3 desktop appearance. Created a new linked owner/admin identity transactionally
with a credential-free audit entry and verified login, one catalog read and logout against the
local server. Existing identities were not modified. This was an explicitly authorized live
identity write; catalog works, notes, scores and artwork were not edited. No startup seeding or
schema migration was introduced. Login details were delivered privately in the chat, not embedded
in application source.

The local server was restarted because its old running binary lacked the new auth/client routes.
The representative desktop redesign now covers the login, shell and library: a custom neutral
palette, bundled IBM Plex Arabic, compact desktop controls, a right-hand RTL sidebar and poster
hierarchy. See [the design checkpoint](../apps/linux/DESIGN.md). Nuvio Desktop/Mobile and GNOME
Adwaita informed layout decisions; source implementation is independent. Full work-detail visual
redesign awaits Aqua's review.

## Work-page and responsive redesign request

Aqua rejected the initial library revision as still too plain and requested a cinematic detail
page, complete catalog information through tabs, and proper adaptation to window sizes. The
reference pages are [Movy Arcane](https://www.movy.sx/tv/94605),
[Cinejoy Arcane](https://cinejoy.pk/series/94605-arcane-2021), and
[Spacedom](https://spacedom.live/tv/dsHPgXTW). Movy and Cinejoy were inspected visually;
Spacedom remained behind browser verification. Use the panorama/title/action hierarchy and
visual episode/cast presentation as guidance, with Nahhasio's own registered artwork and fields.

The authorized expansion covers richer typed work details, summary, metadata, release data,
family risks and notes, scores, credits, vocabulary, awards, relations and artwork where stored.
Every field must remain accessible without inventing missing content or connected playback.
Check library, shell, detail, tabs and actions at wide and narrow sizes, including 480 and 640
pixels. Compose must demonstrate this with actual rendered results; Aqua permits reconsidering
GTK4 if the result remains unsuitable. The toolkit choice does not replace design or responsive
layout work.

## Final local verification and handoff

The owner account was rechecked after restoring the stopped repository-managed PostgreSQL
process: API readiness200, admin login,223catalog works and logout204 passed. PostgreSQL was
restarted with `devenv processes up postgres --detach --no-tui`, preserving its existing data;
no catalog seed or migration was run. The local dashboard was brought back on23100 and API on23103.

The final work-detail expansion exposes the recorded public catalog and editorial fields through
one generated contract, including taxonomy, awards, detailed contributions, artwork metadata,
classification inheritance and safe media/track metadata. See [the complete field inventory](../packages/api-contract/README.md).
Episode-specific warnings/scores/provider IDs do not exist in the current schema; inherited
work/installment values are shown rather than invented.
