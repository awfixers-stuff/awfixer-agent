#!/usr/bin/env bun
/**
 * Post-build hook for `bun run install:local`.
 *
 * Called after the production build completes successfully but before the
 * install/smoke phases. Return a non-zero exit code to abort the full install.
 *
 * Edit this file to add custom post-build steps (archive the binary, run
 * additional validation, deploy to a staging prefix, notify, etc.).
 *
 * Usage (invoked automatically by scripts/install-local.ts):
 *   bun scripts/install-post-build.ts <repo-root> <dist-binary> <version>
 */

import * as path from "node:path";

const [repoRoot, distBinary, version] = process.argv.slice(2);

if (!repoRoot || !distBinary || !version) {
	console.error("Usage: install-post-build.ts <repo-root> <dist-binary> <version>");
	process.exit(64); // EX_USAGE
}

console.log(`[post-build] version=${version} binary=${path.basename(distBinary)}`);

// ── Custom post-build logic goes here ──────────────────────────────────────
// Example — annotate the binary with the build timestamp:
//   import * as fs from "node:fs/promises";
//   const stamp = path.join(path.dirname(distBinary), ".build-stamp");
//   await Bun.write(stamp, new Date().toISOString());
// ────────────────────────────────────────────────────────────────────────────

console.log("[post-build] done");
