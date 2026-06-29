# Package derivation — use with callPackage from default.nix or flake.
# callPackage auto-supplies args matching nixpkgs attribute names.
{ stdenv
, fetchFromGitHub
, cmake
, pkg-config
, ...
}:
stdenv.mkDerivation {
  pname = "myapp";
  version = "0.1.0";

  src = fetchFromGitHub {
    owner = "owner";
    repo = "repo";
    rev = "v0.1.0";
    hash = "sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
  };

  nativeBuildInputs = [ cmake pkg-config ];
  buildInputs = [
    # Runtime libraries, e.g. openssl zlib
  ];

  # installPhase = ''
  #   runHook preInstall
  #   mkdir -p $out/bin
  #   cp mybinary $out/bin/
  #   runHook postInstall
  # '';
}
