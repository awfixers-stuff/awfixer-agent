# Agent Control HTTP API (v1)

**Date:** 2026-07-02  
**Status:** Implemented  
**Companion:** Stats API on port **3847** (`agent stats`); control API on port **3848** (`agent control serve`).

## Goal

Expose a minimal HTTP control plane so remote clients (Android Manage tab, scripts) can **list live agent sessions**, read status, **steer**, and **abort** — mapping to existing JSON-RPC commands in `packages/coding-agent/src/modes/rpc/rpc-types.ts`.

## Architecture

```
Remote client ──HTTP Bearer──► agent control serve (:3848)
                                      │
                                      ▼
                              ControlSessionRegistry
                                      ▲
                                      │ Unix socket JSON-lines
                              agent (interactive / rpc)
                                      │
                                      ▼
                              AgentSession.steer / .abort
```

1. Run `agent control serve` (standalone process).
2. Run `agent` normally; top-level sessions auto-attach when `~/.agent/control.sock` exists.
3. HTTP clients call `/api/sessions` and action endpoints.

Socket path: `~/.agent/control.sock` (overridable via `AGENT_CONTROL_SOCKET`).

## Authentication

| Mechanism | Detail |
|-----------|--------|
| Bearer token | `Authorization: Bearer <token>` on all endpoints except `OPTIONS` and `GET /healthz` |
| Token file | `~/.agent/control.token` (chmod 0600), auto-created on first `control serve` / `control token` |
| `--no-auth` | Disables bearer check (loopback dev only) |
| CORS | `Access-Control-Allow-Origin: *`; preflight without auth |

## Bind address & LAN safety

| Flag / default | Behavior |
|----------------|----------|
| Default bind | `127.0.0.1:3848` — emulator reaches host via `10.0.2.2:3848` |
| `--bind 0.0.0.0:3848` | Listen on all interfaces (physical device on LAN) |
| `--lan-only` (default **on** when hostname is `0.0.0.0`) | Reject client IPs outside loopback + RFC1918 |
| `--no-lan-only` | Allow any client IP (use with caution) |

## Endpoints

### `GET /healthz`

```json
{ "ok": true }
```

### `GET /api/sessions`

List attached live sessions.

**Response 200:**

```json
{
  "sessions": [
    {
      "id": "abc123",
      "label": "my-feature",
      "state": "streaming"
    }
  ]
}
```

`state` is one of: `streaming`, `compacting`, `idle`.

### `GET /api/sessions/:id`

Full status for one session (subset of RPC `get_state`).

**Response 200:**

```json
{
  "id": "abc123",
  "label": "my-feature",
  "state": "idle",
  "isStreaming": false,
  "isCompacting": false,
  "queuedMessageCount": 0,
  "messageCount": 42,
  "sessionFile": "/home/user/.agent/sessions/…/session.jsonl",
  "model": { "provider": "anthropic", "id": "claude-sonnet-4-20250514" }
}
```

**Response 404:** unknown or detached session.

### `POST /api/sessions/:id/steer`

**Body:**

```json
{ "message": "Stop and summarize progress." }
```

**Response 200:** `{ "ok": true }`  
**Response 400:** missing/empty message  
**Response 404:** unknown session

Maps to RPC: `{ "type": "steer", "message": "…" }`.

### `POST /api/sessions/:id/abort`

Empty body.

**Response 200:** `{ "ok": true }`  
**Response 404:** unknown session

Maps to RPC: `{ "type": "abort" }` (uses `USER_INTERRUPT_LABEL` internally, same as RPC mode).

### `GET /api/sessions/:id/events` (optional / v1 stub)

Server-Sent Events stream of session events. **v1 returns 501** until event relay is wired.

## JSON-RPC mapping

| HTTP | RPC command | AgentSession |
|------|-------------|--------------|
| `GET /api/sessions` | `get_state` (per session) | read flags |
| `GET /api/sessions/:id` | `get_state` | read flags + model |
| `POST …/steer` | `steer` | `session.steer(message)` |
| `POST …/abort` | `abort` | `session.abort({ reason: USER_INTERRUPT_LABEL })` |
| `POST …/abort` + body (future) | `abort_and_prompt` | not in v1 |

## CLI

```bash
agent control serve [--bind 127.0.0.1:3848] [--no-auth] [--no-lan-only]
agent control token [--regenerate]
```

## Android client

- Control base URL: same host as stats, port **3848** (swap `:3847` → `:3848`).
- Same optional bearer token as stats settings.
- `ControlRepository.refresh()` → `GET /api/sessions`
- `steer(id, message)` → `POST /api/sessions/:id/steer`
- `abort(id)` → `POST /api/sessions/:id/abort`

## Manual smoke test

```bash
# Terminal 1
agent control serve --bind 0.0.0.0:3848

# Terminal 2
agent

# Terminal 3
TOKEN=$(cat ~/.agent/control.token)
curl -s -H "Authorization: Bearer $TOKEN" http://127.0.0.1:3848/api/sessions | jq
```