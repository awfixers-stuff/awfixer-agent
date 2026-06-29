---
name: js-ts-security
description: Security guidelines and tools for JavaScript and TypeScript projects
---

# JS/TS Security

## Purpose

Guide agents through auditing Node.js, Deno, Bun, and browser-based JS/TS projects.

## Key Areas

1. **Prototype Pollution**: Check `Object.assign`, deep merge functions.
2. **ReDoS**: Look for complex regexes. Use `eslint-plugin-regexp`.
3. **SSRF**: Ensure external URLs are validated before `fetch()` or `axios()`.
4. **XSS**: Check React `dangerouslySetInnerHTML`, Vue `v-html`.
5. **Dependencies**: Use `npm audit` or `bun audit`.

## Tools

- `npm audit` / `yarn audit` / `bun audit`
- `eslint-plugin-security`
- `snyk`
