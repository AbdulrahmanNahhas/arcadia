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

  packages = with pkgs; [
    biome
    typos
  ];

  git-hooks.hooks = {
    biome.enable = true;
    typos.enable = true;
  };

  processes.web.exec = "pnpm dev";

  enterShell = ''
    echo "Web environment ready"
    echo "Node $(node --version) | pnpm $(pnpm --version) | TypeScript $(tsc --version)"
    echo "Run: devenv up"
  '';

  enterTest = ''
    pnpm check
    pnpm test
  '';
}
