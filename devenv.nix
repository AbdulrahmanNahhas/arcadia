{ pkgs, lib, ... }:

{
  languages.javascript = {
    enable = true;
    package = pkgs.nodejs_26;
    npm.enable = false;
    pnpm = {
      enable = true;
      install.enable = true;
    };
  };

  languages.typescript.enable = true;

  # Desktop shell (src-tauri/) — Linux-only bundle targets for now.
  languages.rust.enable = true;

  # Loads the repo-root .env (TMDB/Fanart keys, git-ignored) into the shell. apps/api also loads
  # it directly (apps/api/src/env.ts) so the same code path works outside devenv (CI, prod).
  dotenv.enable = true;

  # Pinned to a high, uncommon port on purpose — 5432/3000/3001 are so widely used by other dev
  # tools that leaving them at defaults invites exactly the collision this pin avoids on a family
  # server that will end up running more than just Arcadia. Also fixes a real flakiness this
  # project hit once: with no explicit port, devenv's postgres landed on 5432 in one session and
  # 5433 in the next (a leftover from a devenv version bump), and nothing here noticed until a
  # `pnpm test` run couldn't connect.
  services.postgres = {
    enable = true;
    initialDatabases = [ { name = "arcadia"; } ];
    listen_addresses = "127.0.0.1";
    port = 23102;
  };

  env.DATABASE_URL = "postgresql://127.0.0.1:23102/arcadia";
  env.VITE_API_URL = "http://127.0.0.1:23101";
  env.ARCADIA_MOCK_AUTH = "true";
  env.ARCADIA_SEED_DEMO_ACCOUNTS = "true";
  # The GDK_BACKEND=x11 fix for WebKitGTK's Wayland DPI bug lives in src-tauri/src/main.rs (not
  # here) so it also applies to the bundled AppImage/deb, not just `devenv shell`.

  # Without this, WebKitGTK's isolated network process finds no TLS backend at all — plain HTTP
  # loads fine (e.g. local /media/... assets) but every https:// request (external artwork
  # previews, any other remote fetch) fails with "TLS support is not available". `glib` alone
  # doesn't include the actual TLS module; glib-networking provides it, and needs to be
  # discoverable via GIO_EXTRA_MODULES since devenv's plain `packages` list doesn't run glib's
  # module-registration setup hook the way a real buildInputs list would.
  env.GIO_EXTRA_MODULES = "${pkgs.glib-networking}/lib/gio/modules";

  # The embedded player (see docs/player-torrent-roadmap.md). libmpv is what src-tauri actually
  # links against — mpv itself is here so a file can be sanity-checked outside the app — and
  # libva/libvdpau are the hardware-decode paths `hwdec=auto-safe` picks from. mpv brings its own
  # ffmpeg, so none of this is for the webview.
  env.GST_PLUGIN_SYSTEM_PATH_1_0 = lib.makeSearchPathOutput "lib" "lib/gstreamer-1.0" [
    pkgs.gst_all_1.gstreamer
    pkgs.gst_all_1.gst-plugins-base
    pkgs.gst_all_1.gst-plugins-good
    pkgs.gst_all_1.gst-plugins-bad
    pkgs.gst_all_1.gst-libav
  ];

  packages = with pkgs; [
    biome
    typos
    # Tauri Linux bundling/runtime deps (AppImage + .deb targets).
    pkg-config
    glib
    glib-networking
    gtk3
    webkitgtk_4_1
    libsoup_3
    librsvg
    libayatana-appindicator
    openssl
    dbus
    patchelf
    # Embedded playback: libmpv (headers for libmpv2-sys) plus the GPU/hardware-decode stack
    # `vo=gpu-next` and `hwdec=auto-safe` need.
    mpv
    libGL
    libva
    libvdpau
    # GStreamer is for WebKitGTK, not the player: the YouTube trailer iframe on the work detail
    # page plays through the webview's own media stack, which had no plugins at all before this.
    # Same reason as the GIO_EXTRA_MODULES entry above — devenv's plain `packages` list doesn't
    # run the module-registration setup hooks, so the plugin path is set explicitly.
    gst_all_1.gstreamer
    gst_all_1.gst-plugins-base
    gst_all_1.gst-plugins-good
    gst_all_1.gst-plugins-bad
    gst_all_1.gst-libav
  ];

  processes.api.exec = "pnpm --filter @arcadia/api dev";
  # Runs the Tauri desktop shell, which starts its own apps/web dev server as part of `tauri dev`
  # (see tauri.conf.json's beforeDevCommand) — don't also define a processes.web here, it would
  # race the same vite dev server on port 23100.
  processes.tauri.exec = "pnpm tauri dev";

  enterShell = ''
    echo "Arcadia environment ready"
    echo "Node $(node --version) | pnpm $(pnpm --version) | PostgreSQL $(postgres --version)"
    echo "Run: devenv up (starts PostgreSQL, the API, and the Tauri desktop app)"
  '';

  enterTest = ''
    pnpm check
    pnpm test
  '';
}
