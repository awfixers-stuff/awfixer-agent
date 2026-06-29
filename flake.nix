{
  description = "Development environment for awfixer-agent (oh-my-pi fork)";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs = { self, nixpkgs }:
    let
      # Systems this flake supports. Add or remove as needed.
      systems = [
        "x86_64-linux"
        "aarch64-linux"
        "x86_64-darwin"
        "aarch64-darwin"
      ];
      forAllSystems = f: nixpkgs.lib.genAttrs systems (system: f system);
      pkgsFor = system: import nixpkgs { inherit system; };
    in {
      devShells = forAllSystems (system:
        let pkgs = pkgsFor system; in {
          default = pkgs.mkShell {
            # Tools needed for development.
            # Bun is intentionally NOT provided here — it is expected from a
            # global install (e.g. ~/.bun) and stays on PATH inside the shell.
            # Add native-build / runtime tools below as the need grows.
            packages = [
              pkgs.nodejs # real Node.js, required by napi-rs for pi-natives builds
              # pkgs.cargo
              # pkgs.rustc
              # pkgs.pkg-config
              # pkgs.openssl
            ];
          };
        });
    };
}
