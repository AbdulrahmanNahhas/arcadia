{ config, pkgs, ... }:

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
  languages.rust.enable = true;
  dotenv.enable = true;

  # Reuse the existing persistent catalog. Startup never migrates or seeds it.
  services.postgres = {
    enable = true;
    package = pkgs.postgresql_17;
    initialDatabases = [ { name = "arcadia"; } ];
    listen_addresses = "127.0.0.1";
    port = 23102;
  };
  env.DATABASE_URL = "postgresql://127.0.0.1:23102/arcadia";
  env.NAHHASIO_BIND = "127.0.0.1:23103";

  packages = with pkgs; [ typos pkg-config openssl mpv chromium ];
  env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH = "${pkgs.chromium}/bin/chromium";

  # SQLx uses the system account database for its default user; the local Node CLI uses USER.
  # Make the development role explicit so both drivers reach the same existing catalog.
  processes.server.exec = ''
    export PGUSER="''${PGUSER:-$USER}"
    exec cargo run --locked -p nahhasio-server
  '';
  processes.server.after = [ "devenv:processes:postgres" ];
  processes.server.ready = {
    http.get = { port = 23103; path = "/api/health/ready"; };
    period = 1;
    timeout = 120;
  };
  processes.web.exec = "pnpm --filter @nahhasio/web dev";
  processes.web.after = [ "devenv:processes:server" ];
  processes.web.ready = {
    http.get = { port = 23100; path = "/login"; };
    period = 1;
    timeout = 120;
  };

  # Temporary opt-in access while the rejected prototype awaits retirement.
  # The GTK client will join default startup only after its first reviewed milestone.
  profiles.legacy-kotlin.module = {
    packages = with pkgs; [ jdk21 gradle ];
    env.JAVA_HOME = "${pkgs.jdk21}";
    env.LD_LIBRARY_PATH = pkgs.lib.makeLibraryPath [
      pkgs.libGL pkgs.fontconfig pkgs.freetype
      pkgs.xorg.libX11 pkgs.xorg.libXext pkgs.xorg.libXrender
    ];
    scripts.nahhasio-legacy-client.exec = ''
      exec "${config.devenv.root}/apps/linux/gradlew" \
        -p "${config.devenv.root}/apps/linux" :composeApp:run
    '';
  };

  # Optional local reference API for migration comparisons; no old desktop runtime.
  profiles.reference-api.module = {
    processes.api.exec = "pnpm --filter @arcadia/api dev";
    env.ARCADIA_MOCK_AUTH = "true";
  };

  enterShell = ''
    echo "Nahhasio environment ready"
    echo "Run: devenv up (PostgreSQL -> Rust API -> dashboard)"
    echo "The new GTK desktop joins startup after its first reviewed milestone"
    echo "Reference API: devenv --profile reference-api up"
  '';

  enterTest = ''
    pnpm check
  '';
}
