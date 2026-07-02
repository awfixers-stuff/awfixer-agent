# Android agent companion — design spec

## Goal

Kotlin + Jetpack Compose companion at repo root `android-app/`: monitor Oh My Pi stats from LAN hosts, with a honest stub for future live agent control (interject / abort).

## Backend reality (verified)

**Stats (works today):** `packages/stats/src/server.ts` on port **3847** (`agent stats` / `/stats`).

| Method | Path | Notes |
|--------|------|--------|
| GET | `/api/stats?range=` | Full `DashboardStats` |
| GET | `/api/stats/overview` | Overview slice |
| GET | `/api/stats/models` | `byModel[]` |
| GET | `/api/stats/folders` | `byFolder[]` |
| GET | `/api/stats/costs` | Cost dashboard |
| GET | `/api/stats/behavior` | Behavior dashboard |
| GET | `/api/stats/timeseries` | `timeSeries[]` |
| GET | `/api/stats/recent?limit=` | `MessageStats[]` |
| GET | `/api/stats/errors?limit=` | Recent errors |
| GET | `/api/request/:id` | `RequestDetails` |
| POST | `/api/sync` | Session scan |
| GET | `/api/stats/gain?range=&project=` | Gain stats |

Types mirror `packages/stats/src/shared-types.ts` and client `packages/stats/src/client/types.ts`.

**Control (missing today):** Interactive abort/steer lives in `AgentSession` and **JSON-RPC** (`packages/coding-agent/src/modes/rpc/rpc-types.ts`: `steer`, `abort`, `abort_and_prompt`, …). No HTTP control plane. Phase 2 requires a new coding-agent service (out of scope for initial scaffold).

## Architecture

```
android-app/
  app/
    data/          # DTOs, StatsApi (Ktor), SettingsStore (DataStore)
    domain/        # StatsRepository, ControlRepository (interface)
    ui/            # Compose screens, theme, navigation
```

- **Phase 1:** `KtorStatsRepository` → existing stats API; pull-to-refresh + manual sync.
- **Phase 2:** `ControlRepository` implementation against future `omp control` HTTP/WS; until then `OfflineControlRepository` shows empty state.

## UX (Phase 1)

- **Overview:** overall aggregates + error rate + cost + sync action.
- **Models / Projects:** lists from `/api/stats/models` and `/api/stats/folders`.
- **Activity:** recent requests; filter errors; tap → request detail (JSON summary).
- **Manage:** placeholder — “Control server not available”.
- **Settings:** base URL (default `http://10.0.2.2:3847` for emulator → host), optional bearer token, time range.

Dark-first Material3. `minSdk 30`, latest `compileSdk`/`targetSdk`, Java 17.

## Security

- Cleartext HTTP allowed only for user-configured LAN/debug hosts (`usesCleartextTraffic` + network security config for private ranges).
- Optional bearer header for future authenticated gateways.

## Testing

- JVM unit tests for URL building and JSON parsing (sample payloads).
- No instrumented tests in initial scaffold.

## Fork (prior session)

User chose **Phase 1 now + stub Phase 2** rather than blocking on a new control server. Proceeding with scaffold under that split.

## Follow-ups

1. Spec for `omp control` HTTP API (session list, steer, abort, events stream).
2. Wire `ControlRepository` when server exists.
3. Optional: mTLS / Tailscale-only profiles.