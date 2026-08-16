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

  services.postgres = {
    enable = true;
    initialDatabases = [ { name = "arcadia"; } ];
    listen_addresses = "127.0.0.1";
  };

  env.DATABASE_URL = "postgresql://127.0.0.1/arcadia";
  env.VITE_API_URL = "http://127.0.0.1:3001";
  env.ARCADIA_MOCK_AUTH = "true";
  env.ARCADIA_SEED_DEMO_ACCOUNTS = "true";

  packages = with pkgs; [
    biome
    typos
  ];

  processes.api.exec = "pnpm --filter @arcadia/api dev";
  processes.web.exec = "pnpm --filter @arcadia/web dev";

  enterShell = ''
    echo "Arcadia environment ready"
    echo "Node $(node --version) | pnpm $(pnpm --version) | PostgreSQL $(postgres --version)"
    echo "Run: devenv up"
  '';

  enterTest = ''
    pnpm check
    pnpm test
  '';
}
