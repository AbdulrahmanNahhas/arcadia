# Isolated GTK4/libmpv rendering proof

This crate is a diagnostic checkpoint, **not normal client integration**. It has
no server/catalog connection, torrents, downloads, Jellyfin, sessions, progress
sync or application UI. All Rust and HTML here were written independently;
no GPL Stremio source was copied.

## Run

From the repository root, inside `devenv shell` (or prefix commands with
`devenv shell --`):

```sh
cargo build -p nahhasio-native-playback-proof --example gtk_local --locked
cargo run -p nahhasio-native-playback-proof --example gtk_local --locked -- \
  /absolute/path/to/local-video.mp4
```

Native buttons: pause/resume, relative ±5s seek, fullscreen. Keyboard:
Space, Left/Right, F11, Escape. `--smoke` runs a 12-second sequence: pause,
resume/seek, fullscreen/unfullscreen, resize, remove/reinsert the GLArea, and
window destruction. It exits nonzero unless two renderer/core generations loaded,
both tore down, rendering produced changing GPU pixel samples, position advanced,
and no native API failures were recorded. Supply a video longer than 15 seconds.

`--web-overlay` adds a **bundled diagnostic HTML WebKit overlay**, not React or
the normal application's interface. Its four buttons dispatch an explicit tiny
command allowlist; it has no network permission or generic native bridge.
Neither a `load-finished` event nor the native smoke PASS alone proves visible
WebKit composition: inspect the actual window/screenshot.

### Actual Shadow runtime command

This machine currently combines a devenv glibc 2.42 build with newer host Mesa
26.2.4/ALSA requiring glibc 2.43+, and the Niri host uses glibc 2.44. A direct
launch with inherited `LD_LIBRARY_PATH` fails before GTK:
`libm.so.6: version GLIBC_2.43 not found (required by libasound.so.2)`.
Removing `LD_LIBRARY_PATH` allows GTK but GLArea reports
`Failed to create EGL display`.

The bounded diagnostic launcher uses the host ELF loader for **this process
only**; it changes neither devenv nor host configuration:

```sh
sh apps/linux/native-playback-proof/examples/run-on-shadow.sh \
  /absolute/path/to/local-video.mp4 --smoke

WEBKIT_DISABLE_DMABUF_RENDERER=1 \
  sh apps/linux/native-playback-proof/examples/run-on-shadow.sh \
  /absolute/path/to/local-video.mp4 --smoke --web-overlay
```

This is an explicit diagnostic workaround, not a packaging solution. The second
command disables WebKit DMA-BUF rendering, **not its sandbox**. Default WebKit
DMA-BUF composition currently fails visibly; details below.

Generate a private reproducible fixture in this turn's scratch directory, or an
ignored workspace preview directory, never `~/Videos`:

```sh
ffmpeg -hide_banner -loglevel error -f lavfi \
  -i testsrc2=size=640x360:rate=30 -t 20 \
  -c:v libx264 -pix_fmt yuv420p "$DELTA_SCRATCH_DIR/native-proof.mp4"
```

## Ownership and FFI exception

Workspace and server `unsafe_code = "forbid"` are unchanged. This dedicated crate
uses `unsafe_code = "deny"` and allows it **only for private `backend.rs`**.
The example forbids unsafe. The normal Linux app has no dependency on this crate.
Public `ProofPlayer` owns GTK lifecycle; callers cannot get raw mpv/GL pointers.
It accepts only an existing canonical local regular file, forces the lavf demuxer
with a `file` protocol whitelist and disables reference loading, user config,
scripts, subtitle/audio auto-discovery and hardware decode.

- `realize`: make/check the GTK EGL desktop-GL context current, create/configure
  mpv, initialize a render context with the generated C ABI, then async-load file.
- Foreign render callback: write a stable boxed atomic only. No GTK, mpv calls,
  blocking, allocation or panic. An 8ms GTK main-thread source coalesces the bit
  into `queue_render` and drains at most 64 events with zero timeout. This is
  deliberately simple polling, not a production idle/wakeup scheduler.
- `render`: recheck the same current context; attach GTK buffers and query its
  actual FBO, using physical dimensions (`allocation × scale_factor`).
  Call update/render with a generated **four-int** FBO and nonblocking target-time
  policy. Restore GTK's FBO binding after mpv; this is essential for composition.
  Three RGBA-pixel readbacks verify actual changing rendered content. These
  synchronous GPU readbacks are diagnostics only, not production behavior.
- Commands and scalar position requests use explicitly render-thread-safe async
  APIs. Event payloads are copied before the next wait call. No raw source path,
  URL, token, arbitrary log event or property payload is printed.
- `unrealize`: remove the polling source, keep/make the retained GDK context
  current, detach callback, free renderer **before** core, then free callback
  userdata and the EGL library. The callback remains live through context free.
  On irrecoverable inability to make that context current, retain native resources
  until process exit instead of freeing with a wrong context or dangling userdata.
  That context-loss fallback is not exercised by the ordinary recreate smoke.

The proof leaves advanced-control disabled, forces software decoding and does
not call `report_swap`: GTK owns compositor presentation and we have not measured
the actual swap timestamp. Do not advertise exact presentation timing or hwdec.
GLX is explicitly rejected; this proof resolves functions via EGL.
The example prevents GTK's locale initialization so `LC_NUMERIC` stays C, as mpv
requires. A localized production app must establish numeric locale before threads.

## Why not libmpv2's safe render wrapper?

Inspected crates.io **libmpv2 6.0.0**, specifically
[`src/mpv/render.rs`](https://docs.rs/crate/libmpv2/6.0.0/source/src/mpv/render.rs)
in the downloaded registry source. Its Rust `FBO` has only `fbo/width/height`
(three ints, no `repr(C)`), but upstream `mpv_opengl_fbo` has four C ints including
`internal_format`. `RenderParam::FBO` type-erases that shorter allocation for
the C API. Its render-context destructor also releases callback userdata before
freeing/unregistering the context. This proof does **not** call that wrapper.
The local downloaded version is the evidence; the repository layout/tag may move.

It uses pinned generated **libmpv2-sys 4.0.1** C structs directly, behind the private
documented boundary. The sys crate is LGPL-2.1; native libmpv's packaging/licensing
still needs review for distribution. No copied dependency implementation.
Upstream contracts consulted:

- [render.h: threading, callback and context lifetime](https://github.com/mpv-player/mpv/blob/master/include/mpv/render.h)
- [render_gl.h: GL state and FBO layout](https://github.com/mpv-player/mpv/blob/master/include/mpv/render_gl.h)
- [GTK GLArea](https://docs.gtk.org/gtk4/class.GLArea.html)

## Actual verification and limits

On Shadow/Niri Wayland using the process-local host-loader workaround:

- Native software-decoded H.264 fixture playback: smoke PASS, **304 renders,
  118 changed GPU samples, two loads, two realize/unrealize generations,
  position 4.03s after recreation, zero adapter failures**.
- Default WebKit overlay: document load completed and native decoding/rendering
  continued, but actual screenshot contained **no WebKit label/buttons**.
  WebKit's subprocess reported the Mesa/glibc mismatch and unsupported DMA-BUF
  format `AB24:0x300000000e08014`. **Default accelerated composition is blocked.**
- With `WEBKIT_DISABLE_DMABUF_RENDERER=1`: screenshot visibly showed the
  transparent WebKit label/buttons together with native video and native controls;
  smoke PASS, **264 renders, 116 changed GPU samples, two generations,
  zero adapter failures**. This proves diagnostic fallback composition only.
- A later fallback-overlay run failed the smoke's minimum-render threshold:
  **14 renders, 7 changed samples**, while both lifecycles completed, position
  advanced and API failures stayed zero. Other runs passed with widely varying
  render counts. Visibility/compositor throttling has not been isolated from
  adapter timing, so this checkpoint does **not** establish stable frame pacing.
- Observed host warnings: missing `libcuda.so.1` despite forced `hwdec=no`,
  accessibility-bus warning in WebKit, and Vulkan swapchain suboptimal warnings.
  No hardware decode, subtitle/audio selection, HDR, exact frame pacing, React
  composition, pointer-driven overlay interaction or performance claim is made.
- The default native-only renderer has been exercised on Wayland. X11/EGL,
  XWayland, different GPUs, driver loss and packaging remain separate checks.

Focused checks:

```sh
env -u LD_LIBRARY_PATH cargo test -p nahhasio-native-playback-proof --locked
cargo clippy -p nahhasio-native-playback-proof --all-targets --locked -- -D warnings
cargo fmt -p nahhasio-native-playback-proof --check
```

The ABI unit test guards the exact target layout; it is not an FFI soundness proof.
No database tests or catalog mutation are involved.

## Integration extension points — not implemented by this checkpoint

Current safe methods: `new(&Path)`, `area()`, `toggle_pause()`, `seek(i32 relative
seconds)`, `diagnostics()`. This is intentionally not a generic mpv command API.
For normal app integration, add typed async setters for pause/mute/volume/speed,
absolute seek, and typed observed status (duration, buffering, EOF, actual hwdec,
audio/subtitle tracks). Track node conversion must copy/validate mpv-owned data
before the next event and retain no native pointers. Keep session/generation IDs
in the parent controller so stale UI commands cannot control a replacement player.
The parent owns app/UI integration and source ownership; this proof does not grant
arbitrary network playback or establish a torrent gateway/download manager.
