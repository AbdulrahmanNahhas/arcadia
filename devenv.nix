{ pkgs, ... }:

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

  services.postgres = {
    enable = true;
    initialDatabases = [ { name = "arcadia"; } ];
    listen_addresses = "127.0.0.1";
  };

  env.DATABASE_URL = "postgresql://127.0.0.1/arcadia";
  env.VITE_API_URL = "http://127.0.0.1:3001";
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
  ];

  processes.api.exec = "pnpm --filter @arcadia/api dev";
  # Runs the Tauri desktop shell, which starts its own apps/web dev server as part of `tauri dev`
  # (see tauri.conf.json's beforeDevCommand) — don't also define a processes.web here, it would
  # race the same vite dev server on port 3000.
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
