# OMP Android companion

Kotlin + Jetpack Compose app for monitoring Oh My Pi stats (`agent stats`, port **3847**).

## Phase 1 (implemented)

- Connect to `GET /api/stats` and related endpoints (see [`docs/superpowers/specs/2026-07-01-android-app-design.md`](../docs/superpowers/specs/2026-07-01-android-app-design.md)).
- Overview, models, recent requests, errors, session sync (`POST /api/sync`).
- Settings: base URL, optional bearer token, time range.

## Phase 2 (stub)

**Manage** tab is offline until an OMP HTTP control server exists (steer/abort today are JSON-RPC only in `packages/coding-agent`).

## Build

Requires Android SDK and JDK 17. Open the `android-app` folder in **Android Studio** (it will create `gradlew` if missing) or install Gradle and run `gradle wrapper`, then:

```bash
cd android-app
./gradlew :app:assembleDebug
```

Default stats URL for emulator: `http://10.0.2.2:3847`. Start stats on the host:

```bash
agent stats
```

## Layout

- `app/src/main/kotlin/io/ohmypi/agentcompanion/data/` — Ktor client, DataStore settings
- `app/src/main/kotlin/io/ohmypi/agentcompanion/domain/` — repositories
- `app/src/main/kotlin/io/ohmypi/agentcompanion/ui/` — Compose UI