# Runnable client player checkpoint

## Run the actual client

Close the previous Nahhasio client window first: the single-instance application cannot
replace a running old native binary.

```sh
devenv shell -- nahhasio-client
```

Log in and press Watch on home, a work, an installment or an episode. The client opens
the player, reads the authorized work metadata, rejects upcoming targets, resolves IMDb
and episode identity, searches Torrentio and tries the first supported source. The visible
source picker supports retry/another source and explicit file selection for ambiguous packs.
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
only when there is exactly one film. Unknown/missing identifiers and noninteger episode
mappings remain visible errors rather than guessed sources.

Source discovery/resolution is isolated in native modules. A future debrid resolver can feed
the same private loopback player path; AllDebrid/EasyDebrid are not connected in this checkpoint.
Direct/debrid candidates stay disabled rather than exposing signed URLs to WebKit.

## Storage and ownership

Kept-video root defaults to Linux's configured Videos directory plus `nahhasio`, normally
`~/Videos/nahhasio`. `NAHHASIO_MEDIA_ROOT` can set an absolute root. Device job/resume state is
under `$XDG_STATE_HOME/nahhasio` (default `~/.local/state/nahhasio`), not PostgreSQL.

“Keep download” adds durable file interest to the existing torrent handle; it does not start
another transfer or discard buffered pieces. Closing the player releases only its playback
lease. Completed/partial files are hash-rechecked on restore. Changing an existing store's
media root is refused instead of silently moving files. Payload deletion is not implemented.

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
It removes inherited foreign library paths, uses the host ELF loader where available and
selects the visually tested non-DMA-BUF WebKit fallback. Native video still uses hardware
decode. Default accelerated WebKit composition remains problematic; font/accessibility and
swapchain warnings remain. No system configuration or sandbox bypass was used.

The opt-in `native-diagnostics` Cargo feature provides `--torrent-smoke` with a generated
40-second local fixture (`NAHHASIO_PLAY_FILE`). Its peers are strictly loopback-only.
Optional screenshot capture has a GTK timing race; the successful final smoke omitted capture.
No commits were created; unrelated design/catalog changes were preserved.
