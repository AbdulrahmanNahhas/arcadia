{
  description = "Arcadia v2 Arabic-first family media archive";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs = { self, nixpkgs }:
    let
      systems = [ "x86_64-linux" "aarch64-linux" ];
      forAllSystems = nixpkgs.lib.genAttrs systems;
    in {
      devShells = forAllSystems (system:
        let
          pkgs = nixpkgs.legacyPackages.${system};
          pnpmNode26 = (pkgs.writeShellScriptBin "pnpm" ''
            exec ${pkgs.nodejs_26}/bin/node ${pkgs.pnpm}/libexec/pnpm/bin/pnpm.cjs "$@"
          '').overrideAttrs (_: { version = pkgs.pnpm.version; });
        in {
          default = pkgs.mkShell {
            packages = with pkgs; [ nodejs_26 pnpmNode26 sqlite ];
            shellHook = ''
              echo "Arcadia · Node $(node --version) · pnpm $(pnpm --version)"
            '';
          };
        });
    };
}
