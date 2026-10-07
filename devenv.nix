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

  packages = with pkgs; [ typos pkg-config openssl ];

  # SQLx uses the system account database for its default user; the local Node CLI uses USER.
  # Make the development role explicit so both drivers reach the same existing catalog.
  processes.server.exec = ''
    export PGUSER="''${PGUSER:-$USER}"
    exec cargo run --locked -p nahhasio-server
  '';
  processes.web.exec = "pnpm --filter @nahhasio/web dev";

  # Optional local reference API for migration comparisons; no old desktop runtime.
  profiles.reference-api.module = {
    processes.api.exec = "pnpm --filter @arcadia/api dev";
    env.ARCADIA_MOCK_AUTH = "true";
  };

  enterShell = ''
    echo "Nahhasio environment ready"
    echo "Run: devenv up (PostgreSQL + Rust server + website)"
    echo "Reference API: devenv --profile reference-api up"
  '';

  enterTest = ''
    pnpm check
  '';
}
