---
name: api-security
description: Security guidelines for REST and GraphQL APIs
---

# API Security

## Purpose

Checklists for generic API security auditing.

## Key Areas

1. **AuthN & AuthZ**: Ensure endpoints enforce authentication and check resource ownership (BOLA/IDOR).
2. **Rate Limiting**: Protect against brute-force and DoS.
3. **Input Validation**: Strictly validate schemas (Zod, Joi, JSON Schema).
4. **Mass Assignment**: Prevent users from updating restricted fields (e.g. `isAdmin`).
5. **CORS**: Ensure strict origins, avoid `Access-Control-Allow-Origin: *` with credentials.
