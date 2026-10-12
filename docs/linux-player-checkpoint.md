# Runnable client player checkpoint

## Run the actual client

Close the previous Nahhasio client window first: the single-instance application cannot
replace a running old native binary.

```sh
devenv shell -- nahhasio-client
```

Log in and press Watch on home, a work, an installment or an episode. The client opens
the player, reads the authorized work metadata, rejects upcoming targets, resolves IMDb
and episode identity, and searches Torrentio. Nothing starts until an explicit source choice.
The visible source picker supports retry/another source and explicit file selection for ambiguous packs.
Download buttons on cards, work pages and released episodes use the same picker with download
intent: the native `media.download` command retains the selected file without attaching mpv.
No source response, no peers or an unsupported mapping produces an error rather than fake
progress. A title carrying IMDb is not a guarantee that Torrentio supplies a working release.

For a local file, use the native folder button or Ctrl+O. Keyboard controls include Space/K,
J/L or arrows, M, F, Escape and F11. Track menus use actual mpv audio/subtitle metadata.
Only SRT/ASS/SSA/VTT external subtitles up to 16 MiB are accepted.

## Source configuration

The native client supports the existing private `ARCADIA_STREAM_ADDON_URL` and
`ARCADIA_STREAM_ADDON_CONFIG` environment variables. `NAHHASIO_TORRENTIO_URL` and
`NAHHASIO_TORRENTIO_CONFIG` take precedence. Without configuration, it uses the public
`https://torrentio.strem.fun` endpoint. Supply private configuration through the existing
ignored environment setup; never commit keys, include them in JavaScript or paste them in logs.

Season numbering deliberately matches the old Tauri API: ordinal among season installments,
excluding movies/specials, not raw installment position. Film IMDb falls back to the parent
only when there is exactly one film. Whole decimal episode numbers such as `3.00` map exactly
to episode 3; fractional specials such as `12.50` remain unsupported, never rounded to another
episode. Unknown/missing identifiers remain visible errors rather than guessed sources.

Source discovery/resolution is isolated in native modules. A future debrid resolver can feed
the same private loopback player path; AllDebrid/EasyDebrid are not connected in this checkpoint.
Direct/debrid candidates stay disabled rather than exposing signed URLs to WebKit.

## Storage and ownership

Kept-video root defaults to Linux's configured Videos directory plus `nahhasio`, normally
`~/Videos/nahhasio`. `NAHHASIO_MEDIA_ROOT` can set an absolute root. Device job/resume state is
under `$XDG_STATE_HOME/nahhasio` (default `~/.local/state/nahhasio`), not PostgreSQL.

New torrent payloads live privately under `$XDG_STATE_HOME/nahhasio/payloads`, not Videos.
“Keep download” adds durable file interest and an export intent to the existing handle; it does
not start another transfer or discard buffered pieces. After the whole selected file is verified,
a blocking export worker reads verified engine ranges and publishes an additional copy at
`<Videos>/nahhasio/<canonical work title>/<original video filename>`. Unsafe title separators are
sanitized; existing filenames are never overwritten. Export intent survives restart, transfers
restore paused, and completion/export requires the app to remain open. A hidden `.partial` can
exist during export. This interim design consumes extra disk space; cache eviction is not implemented.

The additive device SQLite v3 upgrade records each job's payload root, preserving all legacy
jobs/files in their original hash-named Videos folders. Reusing one of those legacy torrents
still uses its old payload location; no files are silently moved or deleted. Changing the
configured legacy Videos root is still refused. Closing the player releases only its playback
lease; completed/partial payloads are hash-rechecked on restore. OpenSubtitles and automatic
`.ar.srt` retrieval are not integrated; external subtitles can still be loaded manually.

The download queue backend exists, but a complete downloads page, storage/cleanup controls,
offline catalog packs, persisted playback resume/sync and automatic watched reconciliation
remain unfinished. Playback progress currently describes the actual active player, not a
promise that it has synchronized to family history. The app never executes downloaded files.

## Security boundary and limits

- Native bridge accepts typed bounded operations, not shell commands, arbitrary mpv commands,
  arbitrary filesystem paths or caller-provided player URLs.
- Production UI is bundled with origin/navigation restrictions; WebKit sandbox remains enabled.
- mpv config/scripts, ytdl and automatic subtitle/audio discovery are disabled.
- FFmpeg formats and protocols are allowlisted; HLS/DASH/concat/image playlists are excluded.
- Native streaming endpoint binds loopback, requires a random capability and exact Host,
  rejects browser Origin headers, serves verified bounded byte ranges and cancels disconnected reads.
- Metainfo/files/counts/paths are bounded and validated; symlinks/traversal and hardlinked payloads
  are rejected. Only video files can become player candidates.
- Tests never download public torrents or write the live family catalog.

These controls do not prove zero vulnerabilities in every native codec/driver/library. Native
decode is not yet a separately sandboxed helper process. VPN/proxy leak guarantees, HDR,
alternate GPUs, X11/GLX and release packaging are not certified here. Torrent participation
can upload pieces; transfers are app-owned and stop on application exit, not an invisible daemon.

## Actual verification

On NixOS/Niri Wayland, controlled hybrid-torrent seeder → leecher → verified range gateway →
libmpv → actual packaged React/WebKit controls passed. Measured H.264 decoder:
`vulkan-copy`; 60 video renders in two seconds. Native pause/resume, seek, Arabic subtitle
selection/appearance, fullscreen and honest zero-progress preview passed through this path.

46 Rust tests passed; two PostgreSQL tests stayed ignored. Eight player browser journeys passed.
Client UI build and workspace all-target Clippy with warnings rejected passed. The browser
journeys are mocked transport tests; the native torrent smoke is separate real playback evidence.
Full `pnpm check` passed lint but stopped on the unrelated formatter issue in
`packages/cli/scripts/check-viewer-parity.mts`. Live external Torrentio playback has not been
independently verified against the family catalog/account; provider/peer availability can fail.

NixOS's newer graphics ABI needs the process-local `bin/nahhasio-native-runtime` launcher.
It removes inherited foreign library paths and uses the host ELF loader where available.
The client now selects WebKit's shared-memory compositor before GTK starts: WebKit 2.52's
Skia software backing store retained transparent updates, causing old pages and control trails.
DMA-BUF remains off by default; native video still uses hardware decode. Font/accessibility
and swapchain warnings remain. No system configuration or WebKit sandbox bypass was used.

The opt-in `native-diagnostics` Cargo feature provides `--torrent-smoke` with a generated
40-second local fixture (`NAHHASIO_PLAY_FILE`). Its peers are strictly loopback-only.
Optional screenshot capture has a GTK timing race; the successful final smoke omitted capture.
That earlier checkpoint did not create commits; unrelated design/catalog changes were preserved.

## Playback bugfix verification — 2026-10-11

- Fixed the radio menu's string-value callback to send actual numeric mpv track IDs (or `null`
  for subtitles off); preserved the in-progress player UI design edits.
- Added exact decimal episode-number tests and a browser audio/subtitle-selection regression.
- Added `transparent_overlay` native regression: the previous compositor retained alpha
  147/179/201 after removal; shared-memory composition cleared to zero, including while paused.
- `devenv shell -- cargo test --workspace --locked`, `pnpm build`, `pnpm typecheck` and
  `pnpm check:rust` passed. Lint passed. `pnpm check` remains blocked by unrelated formatting
  in `packages/cli/scripts/check-viewer-parity.mts`.
- Full player browser suite: six passed, three failed against the in-progress slider/selector
  changes (preview slider disabled assertion, removed timeline selector, removed root selector).
  Focused track/menu rerun: all three passed. These failures were not hidden or repaired by
  reverting the UI edits.
- Fresh packaged native `--player-smoke` passed pause/resume, seek, Arabic subtitles/style,
  fullscreen and preview; 61 native renders in two seconds, decoder `vulkan-copy`.
  Generated local media and isolated storage only; no live database or public torrents.
- Frozen artifacts, exact bounded invocation, logs, hashes and inspected compositor capture:
  ignored `target/native-render-regression/fresh-package-20261011/`. Native binary SHA-256
  `52a4746ff3a4dadc61e99ddcd1ca712c3d94c3b787952275dba218f92d9b4556`,
  packaged JS `index-DDTGWADq.js`. Window geometries observed: 708×841, 1424×841, 1440×900
  logical pixels; CSS viewport/DPR not measured. Optional GTK capture omitted due its known
  timing race; compositor capture succeeded. Physical input, other GPUs and live provider/peer
  availability remain unverified.

Fully quit/relaunch the client before retrying; a second launch can otherwise retain the old
native process. No server restart or catalog database change is needed for these fixes.

## Approved player and download pass — 2026-10-11

- Compact RTL player header, footer transport, artwork-backed episode shelf, grouped/searchable
  actual tracks, timing/style controls, speed presets, source Drawer and explicit keep-download.
  Preserves Aqua's approved floating Drawer and other in-progress design edits.
- Episode labels and score/source-size displays omit unnecessary decimal zeros without changing
  stored catalog numbers. Native episode mapping accepts exact whole decimal strings only.
- Private new-job storage, durable download selection, canonical-title export, no-clobber
  publication and backward-compatible device-store migration implemented as described above.
- `cargo test -p media-transfer --locked`: five passed, including generated loopback v1/v2/hybrid
  transfers, no new Videos payload folders during watch, title export bytes, repeated export,
  restart/corruption behavior, and legacy v2 job-location preservation.
- `cargo clippy -p media-transfer -p nahhasio-linux --all-targets --locked -- -D warnings` passed.
- `pnpm --filter @nahhasio/linux-ui test:e2e --config playwright.player.config.ts`: 15 passed,
  including explicit download-source selection without `media.play`. The separate fixture-dev
  config serves the player harness; ordinary production-preview tests cannot serve that HTML.
- `pnpm exec vitest run apps/linux/ui/src/features/player/source-format.test.ts apps/linux/ui/src/features/work/format.test.ts`:
  26 passed. Linux UI typecheck/build and native build passed; lint passed.
- `pnpm check` remains blocked by unrelated formatting in
  `packages/cli/scripts/check-viewer-parity.mts`; that file was not changed.
- Fresh `target/debug/nahhasio-linux --player-smoke`, launched through the native runtime wrapper
  with generated local H.264/AAC/Arabic-subtitle fixture and isolated state/Videos roots, passed:
  two actual tracks, `vulkan-copy`, 60 native video renders in two seconds, pause/resume, seek,
  fullscreen and honest preview. Requested width 1440; actual viewport/DPR was not measured.
  Fixture server was unreachable loopback port 29999, not the live family server. Fontconfig,
  accessibility-bus and swapchain warnings remain. No screenshot or narrow-native rerun in
  this fast pass; browser tests do not certify physical GTK input or public torrent availability.
- Export collision/disk-space problems currently surface as a generic native warning; a richer
  export-status/recovery UI, legacy layout migration, automatic cache cleanup and subtitle
  sidecar downloads remain follow-ups. No live catalog mutations or public torrent tests.

## Cache cleanup and saved playback — 2026-10-11

- Account dialog now offers confirmed **حذف الذاكرة المؤقتة للتنزيلات**. It removes only inactive
  private torrent jobs/payloads. Active playback/readers, unfinished or missing durable exports,
  symlinks/hardlinks and legacy Videos payloads are protected. Completed Videos copies and
  their saved-playback records survive cleanup. This is cache cleanup, not deletion of saved videos.
- Device SQLite v4 adds stable work/installment/episode mappings and expected export sizes.
  Released episode cards and the player shelf show **محمّلة** only for a registered completed
  file still present at its expected size. Missing files are not reported as downloaded.
- Watch checks native saved storage before Torrentio; native attachment preserves the player
  session and catalog identity. No caller-supplied filesystem path enters the bridge. A missing
  saved file falls back to explicit source selection. Catalog authorization still applies;
  fully offline catalog browsing is not implemented.
- Earlier v3 exports lack episode mappings: explicitly choosing the same source/file once
  registers/reuses the existing exported copy. No filename-based episode guesses or folder scan.
- Fixed preview/source-query ordering so a normal Watch does not trigger Torrentio concurrently
  with the local-file check. Episode selection explicitly restores watch intent, not download intent.
- Zed errors addressed at their root: include the separate player Playwright config in the
  TypeScript project; Cargo writes a private clangd compilation database with actual Nix flags
  and generated CXX includes. `.clangd` and the project Zed query-driver setting use it. Rebuild
  after cleaning target; restart language servers if stale editor errors remain.
- Targeted checks: 17 player browser journeys and six transfer tests passed. Tests cover cache preservation,
  local-record persistence, legacy-root protection and controlled loopback export/restart.
  Linux UI/native builds, targeted all-target Clippy and lint passed. Fresh packaged native
  `--player-smoke` additionally verifies saved-file attachment retains session/catalog identity;
  pause/seek/subtitles/fullscreen/preview passed with 60 native renders in two seconds.
  Same generated private fixture and isolated state as above; no public torrent/catalog writes.
- No new narrow-native capture/physical-input verification. OpenSubtitles, saved-video deletion,
  a full downloads queue and automatic cache eviction are not part of this focused step.
- The original 23 Zed errors cleared. A later project-wide diagnostic refresh surfaced separate
  missing Node test types in `packages/api-contract/tests/*.mts` during concurrent contract work;
  those files/contract changes were not included in this commit. `pnpm check` still stops on
  the pre-existing CLI formatter issue documented above.

## Download dialog and transfer visibility — 2026-10-11

Aqua authorized a fast, focused player/torrent/download reliability pass. Changes remain
uncommitted for review.

- Download requests open a standalone source/file dialog without creating or changing a player
  session. Native download search/preparation keeps catalog authorization and source expiry.
- The rail now opens the device download queue. It shows verified bytes/percentage, payload
  speed, peers, estimated remaining minutes, pause/resume, destination and actionable errors.
  Closing a dialog leaves the durable download running while the application is open.
- Transfer completion, publication to Videos and missing/changed published files are distinct
  states. Export errors reach the UI and existing automatic export retries remain active.
- Source entries are keyed by session and candidate, with expiry and an 800-entry bound, so
  separate download/playback searches do not overwrite one another's candidates.
- Torrents without supported videos fail explicitly. Failed download preparation pauses a
  transfer with no durable/playback interest. Existing private cache and publication guards remain.
- Targeted Linux UI typecheck/build, lint, formatting, native build and all-target Clippy passed.
  Three focused browser journeys passed (download dialog/progress/pause/close at desktop and
  520px, saved-file playback, audio/subtitle selection). Download screenshots were inspected.
- Fresh packaged native player smoke passed local playback, seeking, Arabic track, fullscreen,
  60 live renders and preview, with generated media, unreachable fixture API and isolated storage.
  Native download-dialog rendering, physical input and public torrents were not verified.
- Five of six media-transfer checks passed. The controlled loopback fixture timed out during
  seed verification before peer connection, both in and outside the sandbox; this is unresolved.
  It is not evidence of working public torrent transfer or full production readiness.
- The current devenv evaluation failed fetching nixpkgs because the ephemeral filesystem was
  full. Checks used the already generated project devenv shell environment and installed tools.
  Browser temporary files used a short symlink into ignored persistent preview storage.
  No schema change, live catalog mutation or deployment was performed.
