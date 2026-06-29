# Classic reproducible dev shell — copy to shell.nix in your project.
# Pin nixpkgs: replace the tarball URL with a tested commit from status.nixos.org
let
  nixpkgs = fetchTarball "https://github.com/NixOS/nixpkgs/tarball/nixos-24.11";
  pkgs = import nixpkgs { config = {}; overlays = []; };
in
pkgs.mkShellNoCC {
  packages = with pkgs; [
    # Add dev tools here, e.g. rustc cargo nodejs python3
  ];

  # String attributes become environment variables
  # MY_VAR = "value";

  # shellHook = ''
  #   echo "Dev shell ready"
  # '';
}
