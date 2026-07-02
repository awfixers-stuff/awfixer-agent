# Agent Mobile

Kotlin + Jetpack Compose companion for monitoring [awfixer-agent](https://github.com/awfixers-stuff/awfixer-agent) stats (`agent stats`, port **3847**).

## Phase 1 (implemented)

- Connect to `GET /api/stats` and related endpoints (see [`docs/superpowers/specs/2026-07-01-android-app-design.md`](../docs/superpowers/specs/2026-07-01-android-app-design.md)).
- Overview, models, recent requests, errors, session sync (`POST /api/sync`).
- Settings: base URL, optional bearer token, time range (persisted via DataStore).

## Phase 2 (stub)

**Manage** tab is offline until an awfixer-agent HTTP control server exists (steer/abort today are JSON-RPC only in `packages/coding-agent`).

## Build

Requires Android SDK and JDK 17.

```bash
cd android-app
./gradlew :app:assembleDebug
./gradlew :app:testDebugUnitTest
```

Default stats URL for emulator: `http://10.0.2.2:3847`. Start stats on the host:

```bash
agent stats
```

## Manual test plan

Prerequisites: Android emulator, host running `agent stats` on port 3847.

1. Install debug APK: `./gradlew :app:installDebug`
2. Launch app — default URL `http://10.0.2.2:3847` should reach the host from the emulator
3. Tap **Sync** — snackbar shows indexed message count; Overview/Models populate after sync
4. **Settings** → change base URL, bearer token, and range (`7d` → `24h`) → **Save** → force-stop and relaunch → values persist
5. **Models** tab lists per-model stats; **Activity** shows recent requests and errors
6. **Manage** tab shows the offline control stub (no control server in Phase 1)

On a physical device, use your machine's LAN IP instead of `10.0.2.2`.

## Layout

- `app/src/main/kotlin/codes/awfixer/agentmobile/data/` — Ktor client, DataStore settings, DTOs
- `app/src/main/kotlin/codes/awfixer/agentmobile/domain/` — repositories
- `app/src/main/kotlin/codes/awfixer/agentmobile/ui/` — Compose UI