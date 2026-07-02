#!/usr/bin/env bun
/**
 * One-shot codemod for awfixer-agent rebrand:
 * - @awfixerai/pi-* / @awfixerai/omp-stats → deduplicated @awfixerai/* names
 * - Release binary names omp-* → agent-*
 * - Common metadata strings (can1357, omp.sh, etc.)
 *
 * Skips node_modules, bun.lock, and immutable released CHANGELOG sections are
 * left untouched (only package names inside catalog refs get updated in TS/JSON).
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";

const repoRoot = path.join(import.meta.dir, "..");

/** Longest-first to avoid partial replacements. */
const PACKAGE_REPLACEMENTS: readonly [string, string][] = [
	["@awfixerai/pi-coding-agent", "@awfixerai/agent"],
	["@awfixerai/pi-agent-core", "@awfixerai/agent-core"],
	["@awfixerai/pi-mnemopi", "@awfixerai/mnemopi"],
	["@awfixerai/pi-catalog", "@awfixerai/catalog"],
	["@awfixerai/pi-natives", "@awfixerai/natives"],
	["@awfixerai/pi-utils", "@awfixerai/utils"],
	["@awfixerai/pi-wire", "@awfixerai/wire"],
	["@awfixerai/pi-tui", "@awfixerai/tui"],
	["@awfixerai/pi-ai", "@awfixerai/ai"],
	["@awfixerai/omp-stats", "@awfixerai/stats"],
];

const TEXT_REPLACEMENTS: readonly [string, string][] = [
	["omp-darwin-arm64", "agent-darwin-arm64"],
	["omp-darwin-x64", "agent-darwin-x64"],
	["omp-linux-arm64", "agent-linux-arm64"],
	["omp-linux-x64", "agent-linux-x64"],
	["omp-windows-x64.exe", "agent-windows-x64.exe"],
	["omp-binary-", "agent-binary-"],
	["omp-legacy-pi-bundled:", "agent-legacy-bundled:"],
	["omp-legacy-pi-bundled", "agent-legacy-bundled"],
	["__ompLegacyPiBundledRegistry", "__agentLegacyBundledRegistry"],
	["can1357/oh-my-pi", "awfixers-stuff/awfixer-agent"],
	["git+https://github.com/can1357/oh-my-pi.git", "git+https://github.com/awfixers-stuff/awfixer-agent.git"],
	["https://github.com/can1357/oh-my-pi/issues", "https://github.com/awfixers-stuff/awfixer-agent/issues"],
	["https://github.com/can1357/oh-my-pi", "https://github.com/awfixers-stuff/awfixer-agent"],
	["https://omp.sh", "https://agent.awfixer.codes"],
	["oh-my-pi/pi:dev", "awfixer-agent/agent:dev"],
	["oh-my-pi/pi-base:dev", "awfixer-agent/agent-base:dev"],
	["OMP_RELEASE_NOTES_FLOOR", "AGENT_RELEASE_NOTES_FLOOR"],
	["OMP_REPO", "AGENT_REPO"],
	["omp-monorepo", "awfixer-agent"],
	['"omp": "src/cli.ts"', '"agent": "src/cli.ts"'],
	['"omp": "dist/cli.js"', '"agent": "dist/cli.js"'],
	["PI_ROOT", "AGENT_ROOT"],
	["PI_IMAGE", "AGENT_IMAGE"],
	['bun run pi:image', "bun run agent:image"],
	['bun run pi:run', "bun run agent:run"],
	["omp.%DATE%.log", "agent.%DATE%.log"],
	["omp-crash.log", "agent-crash.log"],
	["omp-debug.log", "agent-debug.log"],
	["omp-plugins.lock.json", "agent-plugins.lock.json"],
	["pi-natives-", "agent-natives-"],
	["class Omp < Formula", "class Agent < Formula"],
	['bin/"omp"', 'bin/"agent"'],
	['Dir["omp-*"]', 'Dir["agent-*"]'],
	['=> "omp"', '=> "agent"'],
	["@awfixerai/pi-coding-agent/latest", "@awfixerai/agent/latest"],
];

const SKIP_DIRS = new Set([
	"node_modules",
	".git",
	"dist",
	".codegraph",
	"target",
	"binaries",
]);

const EXTENSIONS = new Set([
	".ts",
	".tsx",
	".js",
	".mjs",
	".cjs",
	".json",
	".jsonc",
	".md",
	".yml",
	".yaml",
	".sh",
	".ps1",
	".rb",
	".py",
	".toml",
	".jl",
	".plist",
	".dockerfile",
	".rs",
	".nix",
	".html",
	".xml",
	".txt",
]);

async function walk(dir: string, out: string[]): Promise<void> {
	let entries: string[];
	try {
		entries = await fs.readdir(dir);
	} catch {
		return;
	}
	for (const name of entries) {
		if (SKIP_DIRS.has(name)) continue;
		const full = path.join(dir, name);
		const stat = await fs.stat(full);
		if (stat.isDirectory()) {
			await walk(full, out);
			continue;
		}
		const ext = path.extname(name).toLowerCase();
		const base = name.toLowerCase();
		if (
			EXTENSIONS.has(ext) ||
			base === "dockerfile" ||
			base.startsWith("dockerfile.") ||
			base === "cargo.toml"
		) {
			out.push(full);
		}
	}
}

function applyReplacements(text: string): string {
	let out = text;
	for (const [from, to] of PACKAGE_REPLACEMENTS) {
		out = out.split(from).join(to);
	}
	for (const [from, to] of TEXT_REPLACEMENTS) {
		out = out.split(from).join(to);
	}
	return out;
}

const SKIP_FILES = /(?:^|\/)(?:CHANGELOG\.md|legacy-pi-compat\.ts|legacy-pi-bundled-registry\.ts|legacy-pi-bundled-keys\.ts)$/;

async function main(): Promise<void> {
	const files: string[] = [];
	await walk(repoRoot, files);

	let changed = 0;
	for (const file of files) {
		if (file.includes(`${path.sep}node_modules${path.sep}`)) continue;
		if (file.endsWith(`${path.sep}bun.lock`)) continue;
		if (file.endsWith("scripts/rebrand-codemod.ts")) continue;
		const rel = path.relative(repoRoot, file);
		if (SKIP_FILES.test(rel)) continue;

		const before = await fs.readFile(file, "utf8");
		const after = applyReplacements(before);
		if (after !== before) {
			await fs.writeFile(file, after);
			changed++;
		}
	}
	console.log(`rebrand-codemod: updated ${changed} files`);
}

await main();