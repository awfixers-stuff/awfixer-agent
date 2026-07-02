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
        let
          pkgs = pkgsFor system;
          # android-app targets Java 17 (see app/build.gradle.kts).
          jdk = pkgs.jdk17;
        in {
          default = pkgs.mkShell {
            # Tools needed for development.
            # Bun is intentionally NOT provided here — it is expected from a
            # global install (e.g. ~/.bun) and stays on PATH inside the shell.
            # Add native-build / runtime tools below as the need grows.
            packages = [
              pkgs.nodejs
              jdk
              pkgs.kotlin
              pkgs.gradle
              pkgs.swift
              pkgs.swift-format
              pkgs.swiftlint
              pkgs.swiftpm
              # pkgs.cargo
              # pkgs.rustc
              pkgs.pkg-config
              # pkgs.openssl
            ];

            # String attributes become environment variables in mkShell.
            JAVA_HOME = jdk.home;
            JAVACMD = "${jdk.home}/bin/java";
            GRADLE_OPTS = "-Dorg.gradle.java.home=${jdk.home}";

            shellHook = ''
              # Android SDK (host install; override ANDROID_HOME if yours lives elsewhere).
              if [ -z "''${ANDROID_HOME:-}" ] && [ -d "$HOME/.android/sdk" ]; then
                export ANDROID_HOME="$HOME/.android/sdk"
              fi
              export ANDROID_SDK_ROOT="''${ANDROID_HOME:-}"
            '';
          };
        });
    };
}
