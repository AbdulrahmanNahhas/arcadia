# Client playback and downloads

Decision record for Aqua's approved client player implementation and client-media direction.
This supplements [the Linux client plan](./linux-client-plan.md). It does not claim that
playback, torrent streaming or downloads are already connected to the application.

## Scope and review boundary

Aqua approved proceeding with the native rendering proof after reviewing Stremio and the
historical Nahhasio player. Playback and transfer work in this plan belongs to the **client**:

- Local video, torrent playback, device downloads, audio/subtitles and restart recovery.
- The existing API still owns catalog data, identity, authorization and synchronized family state.
- No Jellyfin integration, home-server download worker, server storage/import flow or dashboard
  download manager in this checkpoint. Their older plans are not implementation prerequisites.
- Keep the concurrent work/home/browse design pass intact. The work page supplies the visual
  language; Aqua's five player screenshots supply interaction references, not reusable assets.
- Aqua subsequently authorized continuous agent implementation and testing until the client
  player works, without stopping at each small/visible checkpoint. This covers necessary
  player Rust, UI and client setup. It does not authorize rewriting unrelated Rust exercises.
- NixOS is the current client target. Future Fedora Atomic server deployment is independent
  of this native player and must not become a prerequisite for local/torrent playback.

Continue through the rendering proof and actual application integration, reporting evidence
and material limits. Stop for a decision or blocker requiring Aqua's involvement, rather than
for every small player change. The checkpoints below remain acceptance gates, not forced stops.
Do not enable the application's Play/Download buttons on the strength of an isolated example.
No commit, broad cleanup or automatic move/delete of personal videos is authorized.

## Architecture

Use the existing Rust GTK4/libadwaita/WebKitGTK shell and React/Vite/TypeScript UI. Do not
adopt Stremio's whole application core or introduce a Node streaming server.

| Boundary                    | Owns                                                                            | Must not own                                                    |
| --------------------------- | ------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Client UI                   | Controls, panels, selection, accessible navigation and presentation             | Credentials, paths, torrent session or arbitrary mpv commands   |
| Client playback coordinator | Selected work/episode/source, player session, resume and source switching       | GTK widgets or torrent-engine implementation details            |
| Native player adapter       | libmpv, GTK rendering lifecycle, transport, tracks and measured playback events | Catalog policy, downloads or provider search                    |
| Transfer manager            | One engine session, transfer identity, file interests, retention and scheduling | UI components or a second copy of the same torrent for playback |
| Device store                | Versioned jobs, mappings, preferences, saved packs and progress outbox          | A replacement catalog or PostgreSQL credentials                 |
| Source/subtitle adapters    | Bounded provider requests, parsed candidates and provenance                     | Implicit playback, script execution or trusted filename claims  |

Keep UI-independent media behavior free of GTK, WebKit and Tauri. Introduce a shared crate
only when working code needs that boundary. Put unsafe native FFI behind a small reviewed
adapter; keep `unsafe_code = "forbid"` in the server and ordinary client/application code.

### Player

Choose **libmpv's OpenGL render API in GTK4 `GLArea`** as the first renderer to test.
This avoids the historical GTK3/X11 child-window `wid` approach and its X11 dependency.
The goal is reliable native video, hardware decoding where supported, libass subtitles and
responsive controls, not a claim that the newest graphics API is automatically better.

GTK owns the current GL context and framebuffer. The adapter owns mpv and its render context.
mpv callbacks notify the GTK main thread; they do not invoke GTK or render from a worker.
Realize/unrealize, queued callbacks, renderer replacement and teardown need explicit lifetimes.
Do not load user mpv configuration, scripts or arbitrary URL resolvers in the embedded player.

WebKit is the controls surface, not the video decoder. Transparent WebKit-over-video composition
is a **test gate**, not an assumed property of a native-only `GLArea` demo. If it fails on the
target compositor, review a measured alternative before building the full player UI.

The typed bridge exposes only supported operations: open a native-resolved source, pause/resume,
seek, volume/mute, fullscreen, speed, select audio/subtitle track and subtitle delay/appearance.
Local-file selection uses native dialogs and opaque IDs, not arbitrary JavaScript paths.
Events carry a session/generation ID; late events from a replaced source cannot mutate the new
session. Coalesce position/statistics events, but preserve errors and lifecycle transitions.

Report actual hardware decoder/codec, frame drops, buffering and track availability. A configured
`hwdec` value is not evidence that hardware decoding is active. HDR, zero-copy, every GPU and
Wayland/XWayland compatibility remain unproven until tested. Start with correct SDR playback
and honest diagnostics rather than advertising capabilities from settings alone.

### Torrents and shared transfer ownership

Choose **libtorrent-rasterbar 2.x**, dynamically linked from the locked Nix environment,
behind a narrow Rust/C++ adapter. Its mature resume, priority/network controls and v2/hybrid
support outweigh the small C++ boundary for this client. Do not write a new BitTorrent engine,
adopt an immature general-purpose wrapper, or add a Node/qBittorrent sidecar. Keep handles
behind the transfer adapter so engine details do not spread into GTK, the player or UI.

The inspected rqbit revision
[`57e95d16`](https://github.com/ikatson/rqbit/tree/57e95d16c830863a1fde32d8fa98153b53a3d0b4)
documents prioritized streaming/seek, file selection and persistence. Its inspected
[`torrent_metainfo.rs`](https://github.com/ikatson/rqbit/blob/57e95d16c830863a1fde32d8fa98153b53a3d0b4/crates/librqbit_core/src/torrent_metainfo.rs)
uses `TorrentMetaV1`, SHA-1 and 20-byte hashes. This does **not** establish native BEP 52/v2
support or v2-only magnet support; do not advertise them. Treat libtorrent's documented
v2/hybrid support and piece-deadline controls as a serious advantage in the comparison.
This is why the continuously authorized implementation selects libtorrent rather than
quietly reducing the requirement to keep everything Rust. The locked nixpkgs source supplies
libtorrent-rasterbar 2.0.12; protocol/recovery/streaming still need tests of the actual build.

Deduplicate by verified torrent identity, not provider label or magnet string. A transfer has
independent interests: a playback lease, selected-file download jobs and any explicit seeding
policy. Download priority covers selected files; playback prioritizes data needed at the current
position where the engine supports it. Unselected files in a season pack must not be downloaded
in full just to play one episode; shared boundary pieces can still contain bytes from neighbors.

Selecting **Keep download** adds a durable selected-file interest to the existing transfer.
It does not start another engine/session or discard buffered pieces. Leaving the player releases
only its playback lease. Pausing one job must not break another job/player using the same torrent.
Do not rename active engine files or promise seamless promotion until the adapter proves its
storage/retarget behavior.

Use a loopback-only HTTP range gateway for mpv if needed. Support correct `HEAD`, bounded
single-range/suffix/open-range requests and `416`; wait for verified pieces and cancel reads when
the consumer leaves. A seek must not wait for all preceding bytes. Bound stalled reads and
concurrent requests. Use an unguessable per-session capability, never log it, and keep it out of
WebKit. Loopback alone is not authorization; reject unrelated browser origins and path traversal.

Torrent metadata and provider responses are untrusted. Limit sizes/file counts, normalize paths,
reject absolute paths/traversal/symlink escapes and require a verified selected-file mapping.
Never silently map an episode to the largest file. Preserve the original torrent-relative layout
inside the engine's root; present friendly catalog names separately.

Seeding, upload limits, network binding/proxy behavior and whether jobs survive application exit
are explicit product policies. In the initial app-owned manager, closing the application stops
transfers after persisting state; it does not leave an undocumented background daemon.
Recommend no continued seeding after the final playback/download interest finishes by default,
with later opt-in ratio/time limits. Active torrent participation may still upload pieces; do not
describe this default as a zero-upload mode. Confirm the policy before enabling torrent traffic.

### Downloads and recovery

Use a **versioned local SQLite database**, not an in-memory queue or a JSON file that resets
silently on parse errors. This stores device state only; it does not add another PostgreSQL
migration tree. Catalog migrations remain exclusively in `packages/database/drizzle/`.

Persist intent before network activity: job ID, work/episode and source identity, selected file
indices, storage root, retention, requested state and failure/retry information. Engine resume
data is separate from UI/job intent. Per-file completion uses verified pieces, not total-torrent
percentage or the existence/allocated size of a file.

Expose queued, resolving metadata, downloading, paused, verifying, completed, blocked and failed
states with useful reasons. Low space, missing/remounted storage, unknown episode mapping and
authentication errors are not generic retries. Bound concurrency; do not interrupt playback to
meet an arbitrary queue slot limit. Show progress, speed, selected size, ETA when estimable,
peers and upload activity without inventing values.

On restart, reconcile intent, engine resume data and disk contents. Missing files become missing,
partial files are rechecked/resumed, and corrupted state produces a recoverable error rather than
an empty library. Protect single-instance store/engine ownership. Device migrations need backups,
transactional upgrades and an explicit policy for unsupported/newer schema versions.

Remove a job and delete its files are different actions. Deleting data requires explicit
confirmation and refuses files still leased by another player/job. Cleanup consults retained
interests and current leases, never wipes a whole directory at startup. Completed user-owned
videos are never automatic cache-eviction candidates.

## Storage

Recommended kept-media default: **`$XDG_VIDEOS_DIR/nahhasio`**, normally `~/Videos/nahhasio`.
Read the configured Linux user directory; never shell-evaluate its value. Fall back clearly
when unset, and let Aqua choose a different root/mount in Settings. No folder is created by
this planning/rendering checkpoint.

| Data                                                | Default ownership/location                                                         |
| --------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Kept videos                                         | Chosen Videos root; user-owned, visible files                                      |
| Durable partial downloads                           | Managed staging on the chosen media filesystem; not disposable XDG cache           |
| Temporary streaming pieces                          | Separate managed, quota-limited area; retention protects promoted transfers        |
| Jobs, mappings, engine resume and progress outbox   | `$XDG_STATE_HOME/nahhasio`, normally `~/.local/state/nahhasio`                     |
| Saved metadata/artwork packs and retained subtitles | `$XDG_DATA_HOME/nahhasio`, normally `~/.local/share/nahhasio`                      |
| Regenerable images/provider caches                  | `$XDG_CACHE_HOME/nahhasio`, normally `~/.cache/nahhasio`                           |
| Preferences                                         | `$XDG_CONFIG_HOME/nahhasio`, normally `~/.config/nahhasio`                         |
| Credentials/API keys                                | Native secret storage or private runtime configuration; never committed/UI storage |

Keep streaming storage and durable downloads logically separate, even when a staging area on
the same media filesystem lets them share pieces cheaply. The transfer proof must establish
promotion/retargeting and crash recovery before fixing the final staging layout. Across
filesystems, warn about copy cost and free space; never pretend a rename is atomic there.
Changing the configured default affects new jobs only. Existing jobs retain their root; moving
them is a separate explicit operation with recovery and no unattended deletion of originals.

Completed media should have readable release/work folders without breaking engine file paths.
Expose the actual local file through **Show in folder**. Do not assume `.part` renaming or
hardlinks are supported on every chosen filesystem. Keep downloaded video independent of a
saved work pack: removing metadata does not delete video, and saving metadata does not fetch it.
Verify the chosen locations are persistent on Shadow before real retained downloads.

## Player and download UI brief

Use the work page's reviewed palette, typography and controls rather than creating a second
theme. The video is the main surface. Use subtle top/bottom scrims, not continuous full-screen
blur or opaque panels that obscure subtitles. The signature is a **language-first source card**:
Arabic audio/subtitle availability is readable before technical details.

- **Transport:** back, title and episode context; seekbar, play/pause, ±10 seconds, volume,
  time, episodes, sources, audio/subtitles, settings and fullscreen. Auto-hide only during
  playback without interaction; retain controls while focused, paused or a panel is open.
  Buffering is visible without replacing the film with an indefinite spinner.
- **Episodes:** a season/installment selector and a horizontal still-card rail, now-playing
  state, real episode names and availability. Show details on demand. Do not fabricate stills.
  Switching episodes does not silently change a retained download selection.
- **Sources, not “Servers”:** this panel contains local files, torrents and supported direct
  sources, not server administration. Each candidate shows release/provider, resolution,
  codec/HDR when known, size, seed/peer freshness, local/download status and availability.
  Keep raw torrent IDs and technical diagnostics in a disclosure.
- **Language evidence:** separate **Audio** and **Subtitles** rows with Arabic/English/Spanish
  names plus optional representative flags. Flags are supplemental, not language identifiers.
  A provider/release-name hint is labeled **Reported**; actual opened/probed tracks are
  **Verified**. Unknown is not “no subtitles,” and a language hint is not proof of a dub.
  Show original/dub, commentary, forced and SDH/hearing-impaired labels only when supported.
- **Subtitles:** Off, embedded tracks, torrent sidecars, local file and OpenSubtitles results;
  group by language, then release/provider/format and matching evidence. Include search,
  delay/reset, size/color/position and a choice to preserve styled ASS vs override.
  Test Arabic shaping, RTL and required fonts through libass. No browser-rendered subtitle
  duplication. OpenSubtitles credentials, quotas, terms and offline retention need review.
- **Audio:** language/title, channels/codec and track switching, audio delay/reset where
  supported. Changing sources preserves time only when the same episode/cut is established;
  never promise subtitle synchronization between unrelated releases.
- **Settings:** playback speed, fit/aspect, autoplay next episode, subtitle preferences and
  sleep timer when implemented. Diagnostics stay secondary. Casting, watch party, PiP and
  HDR switches are absent or visibly unavailable until their real native paths exist.
- **Downloads page:** active queue first, then kept media; compact selected-episode/file
  detail, pause/resume/retry, storage and upload limits, Show in folder, and explicit deletion.
  Use multi-episode selection for packs instead of ambiguous “download season” guesses.

Open one panel at a time with escape/close and focus return. Keep keyboard navigation,
screen-reader labels, RTL layout, contrast, reduced motion and narrow-window layouts.
Timecodes and the playback timeline remain directionally coherent in Arabic UI; arrow-key
seeking must not hijack a text input or track menu. Final controls need native WebKit tests,
not only Chromium screenshots.

Progress/resume is separate from explicit manually watched state. Playback emits session-scoped
progress and locally queues synchronization; it must not erase an explicit watched decision or
pretend that offline progress is already accepted by the server.

## Implementation checkpoints

1. **Native rendering proof:** generated/local video, sound, seek, actual decoder
   diagnostics, subtitles, fullscreen/resize, WebKit composition and safe teardown/context
   recreation. Measure on available display/GPU; list untested environments.
2. **Player contract and one real local-file journey:** review the visible player controls and
   lifecycle before connecting provider/torrent behavior.
3. **Torrent transfer proof:** controlled lawful fixtures, selected-file/range seeking,
   deduplication, keep-during-stream, restart verification and storage-promotion evidence.
   Select/pin the engine only after the required capability checks.
4. **Durable device downloads:** SQLite intent/recovery, queue, low-space/cancellation and
   deletion protections, then one reviewed download page.
5. **Sources/subtitles/offline integration:** client-side configured source providers,
   real language evidence, OpenSubtitles, saved packs and progress reconciliation.

These are evidence/acceptance gates within the continuously authorized player pass. Do not
call an untested or unavailable capability complete. No unfinished exercise enters a normal
user flow, and unrelated design/catalog work remains outside this implementation.

## References and reuse boundary

Source inspection is not runtime validation. Relevant upstream references:

- [Stremio Linux shell](https://github.com/Stremio/stremio-linux-shell), especially
  `src/app/video/imp.rs`, `src/app/video/mod.rs` and `src/app/webview/imp.rs`: GTK4/libmpv
  render integration and WebKit composition. Shell license: GPL-3.0-only.
- [Stremio core](https://github.com/Stremio/stremio-core/tree/development),
  `src/models/player.rs` and `src/models/streaming_server.rs`: application orchestration
  and streaming-server requests, not evidence of a durable device-download queue. MIT.
- [Stremio web](https://github.com/Stremio/stremio-web): React/core-WASM separation, GPL-2.0.
  [stremio-video](https://github.com/Stremio/stremio-video) had no verified repository license
  in the initial inspection; do not reuse its code without resolving this.
- [rqbit](https://github.com/ikatson/rqbit): Rust engine candidate, Apache-2.0.
- [libtorrent](https://libtorrent.org/): mature alternative to evaluate against required features.
  Its [core license](https://github.com/arvidn/libtorrent/blob/RC_2_1/LICENSE) is BSD-3-Clause,
  with separate notices for included/adapted components.
- [OpenSubtitles API](https://opensubtitles.stoplight.io/docs/opensubtitles-api/e3750fd63a100-getting-started):
  native `Api-Key`/product `User-Agent`, account bearer-token handling and response-driven
  rate/download limits. Search does not automatically download files. Review terms and
  retention before shipping; never hard-code one account quota or put keys into JavaScript.
- [mpv copyright](https://github.com/mpv-player/mpv/blob/master/Copyright): default GPL build
  vs LGPL-compatible configuration and linked dependencies need actual distribution review.
- Historical local player/download/gateway code: Git `69a3cc1:src-tauri/src/`.
  Carry forward tested behavior, not GTK3/X11 window glue or startup cache deletion.

Implement independently from GPL Stremio sources. The MIT workspace license does not establish
the license of the distributed libmpv/FFmpeg build. Check the actual packaged components before
distribution, and pin inspected upstream revisions when recording engine/FFI findings.
