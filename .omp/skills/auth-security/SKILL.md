---
name: auth-security
description: Security guidelines for auth frameworks (Better-Auth, Auth-Core)
---

# Auth Security

## Purpose

Audit authentication systems, specifically focusing on modern frameworks.

## Key Areas

1. **Session Cookies**: Must use `HttpOnly`, `Secure`, and `SameSite=Lax` (or `Strict`).
2. **JWT Security**: Always verify the signature algorithm. Never accept `none`. Use strong secrets.
3. **CSRF**: Ensure CSRF tokens or SameSite cookie policies are strictly enforced for state-changing endpoints.
4. **OAuth State**: Use `state` and `pkce` parameters to prevent CSRF and auth code interception.
5. **Password Storage**: Ensure bcrypt or Argon2 are used with proper work factors.
