{ pkgs, ... }:
let
  pnpmNode26 = (pkgs.writeShellScriptBin "pnpm" ''
    exec ${pkgs.nodejs_26}/bin/node ${pkgs.pnpm}/libexec/pnpm/bin/pnpm.cjs "$@"
  '').overrideAttrs (_: { version = pkgs.pnpm.version; });
in {
  languages.javascript = {
    enable = true;

    npm.enable = false;

    pnpm = {
      enable = true;
      package = pnpmNode26;
      install.enable = true;
    };

    package = pkgs.nodejs_26;
  };

  languages.typescript = {
    enable = true;
    lsp.enable = true;
  };
}
