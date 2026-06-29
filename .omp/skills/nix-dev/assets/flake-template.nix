# Minimal flake — copy to flake.nix in your project root.
{
  description = "My project";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-24.11";
    # flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, ... }@inputs: let
    system = "x86_64-linux"; # or builtins.currentSystem
    pkgs = nixpkgs.legacyPackages.${system};
  in {
    packages.${system}.default = pkgs.callPackage ./package.nix { };

    devShells.${system}.default = pkgs.mkShell {
      packages = with pkgs; [
        # Add dev tools here
      ];
      # inputsFrom = [ self.packages.${system}.default ];
    };

    # apps.${system}.default = {
    #   type = "app";
    #   program = "${self.packages.${system}.default}/bin/myapp";
    # };
  };
}
