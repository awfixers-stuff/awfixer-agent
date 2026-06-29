#!/usr/bin/env bun
/**
 * Production build + FHS install under ~/.local.
 *
 * Layout (PREFIX defaults to $HOME/.local, override with LOCAL_PREFIX):
 *
 *   $PREFIX/bin/omp              → libexec/omp/current/omp
 *   $PREFIX/bin/agent            → libexec/omp/current/omp  (rebrand alias)
 *   $PREFIX/libexec/omp/<ver>/omp
 *   $PREFIX/libexec/omp/current  → <ver>
 *   $PREFIX/lib/omp/natives/<ver>/*.node
 *   $PREFIX/agent/versions/<ver>/manifest.json
 *   $PREFIX/agent/versions/<ver>/natives/*.node
 *
 * The `agent/` tree holds versioned “complex” payloads (native addons + manifest)
 * that the loader can discover beside the compiled binary. User runtime config
 * still lives at ~/.omp/agent (or XDG paths) — this install tree is immutable
 * application data, not editable settings.
 */

import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { $ } from "bun";

const repoRoot = path.join(import.meta.dir, "..");
const codingAgentPkg = path.join(repoRoot, "packages", "coding-agent", "package.json");
const nativesDir = path.join(repoRoot, "packages", "natives", "native");
const distBinary = path.join(repoRoot, "packages", "coding-agent", "dist", "omp");

const isDryRun = process.argv.includes("--dry-run");
const skipBuild = process.argv.includes("--skip-build");
const skipSmoke = process.argv.includes("--skip-smoke");

function parsePrefix(): string {
	const flag = process.argv.find(arg => arg.startsWith("--prefix="));
	if (flag) return path.resolve(flag.slice("--prefix=".length));
	const env = Bun.env.LOCAL_PREFIX?.trim();
	if (env) return path.resolve(env);
	return path.join(os.homedir(), ".local");
}

async function pathExists(target: string): Promise<boolean> {
	try {
		await fs.access(target);
		return true;
	} catch {
		return false;
	}
}

async function ensureDir(dir: string): Promise<void> {
	if (isDryRun) {
		console.log(`mkdir -p ${dir}`);
		return;
	}
	await fs.mkdir(dir, { recursive: true });
}

async function copyFileAtomic(src: string, dest: string, mode = 0o755): Promise<void> {
	if (isDryRun) {
		console.log(`cp ${src} ${dest}`);
		return;
	}
	await ensureDir(path.dirname(dest));
	const tmp = `${dest}.tmp.${process.pid}`;
	await fs.copyFile(src, tmp);
	await fs.chmod(tmp, mode);
	await fs.rename(tmp, dest);
}

async function symlinkAtomic(target: string, linkPath: string): Promise<void> {
	if (isDryRun) {
		console.log(`ln -sfn ${target} ${linkPath}`);
		return;
	}
	await ensureDir(path.dirname(linkPath));
	try {
		await fs.unlink(linkPath);
	} catch (err) {
		if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
	}
	await fs.symlink(target, linkPath);
}

async function listNativeAddons(): Promise<string[]> {
	let entries: string[];
	try {
		entries = await fs.readdir(nativesDir);
	} catch (err) {
		if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
		throw err;
	}
	return entries.filter(name => name.startsWith("pi_natives.") && name.endsWith(".node")).sort();
}

async function runProductionBuild(): Promise<void> {
	if (skipBuild) {
		if (!(await pathExists(distBinary))) {
			throw new Error(`--skip-build set but ${distBinary} is missing; run a build first`);
		}
		console.log("Skipping build (--skip-build)");
		return;
	}

	console.log("Building natives…");
	if (isDryRun) {
		console.log("DRY RUN bun run build:native");
		console.log("DRY RUN bun --cwd=packages/coding-agent run build");
		return;
	}

	await $`bun run build:native`.cwd(repoRoot);
	await $`bun --cwd=packages/coding-agent run build`.cwd(repoRoot);

	if (!(await pathExists(distBinary))) {
		throw new Error(`Expected compiled binary at ${distBinary}`);
	}
}

async function runPostBuild(version: string): Promise<void> {
	if (isDryRun) {
		console.log("DRY RUN post-build hook");
		return;
	}
	if (skipBuild) {
		return; // no build happened — nothing to post-process
	}
	const hook = path.join(import.meta.dir, "install-post-build.ts");
	if (!(await pathExists(hook))) {
		return; // no hook script — proceed
	}
	const { exitCode } = await $`bun ${hook} ${repoRoot} ${distBinary} ${version}`.cwd(repoRoot).nothrow();
	if (exitCode !== 0) {
		throw new Error(`Post-build hook failed (exit ${exitCode}); aborting install`);
	}
}

async function installLayout(prefix: string, version: string): Promise<void> {
	const libexecVersion = path.join(prefix, "libexec", "omp", version);
	const libexecCurrent = path.join(prefix, "libexec", "omp", "current");
	const binOmp = path.join(prefix, "bin", "omp");
	const binAgent = path.join(prefix, "bin", "agent");
	const libNatives = path.join(prefix, "lib", "omp", "natives", version);
	const agentVersion = path.join(prefix, "agent", "versions", version);
	const agentNatives = path.join(agentVersion, "natives");

	const nativeAddons = await listNativeAddons();
	const platformTag = `${process.platform}-${process.arch}`;

	const manifest = {
		name: "@oh-my-pi/pi-coding-agent",
		version,
		platform: platformTag,
		installedAt: new Date().toISOString(),
		repoRoot,
		layout: {
			bin: { omp: binOmp, agent: binAgent },
			libexec: libexecVersion,
			lib: libNatives,
			agent: agentVersion,
		},
		natives: nativeAddons,
	};

	console.log(`Installing omp ${version} → ${prefix}`);

	await ensureDir(libexecVersion);
	await ensureDir(libNatives);
	await ensureDir(agentNatives);

	await copyFileAtomic(distBinary, path.join(libexecVersion, "omp"), 0o755);
	await symlinkAtomic(version, libexecCurrent);
	await symlinkAtomic(path.join("..", "libexec", "omp", "current", "omp"), binOmp);
	await symlinkAtomic(path.join("..", "libexec", "omp", "current", "omp"), binAgent);

	for (const filename of nativeAddons) {
		const src = path.join(nativesDir, filename);
		await copyFileAtomic(src, path.join(libNatives, filename), 0o644);
		await copyFileAtomic(src, path.join(agentNatives, filename), 0o644);
	}

	if (isDryRun) {
		console.log(`write ${path.join(agentVersion, "manifest.json")}`);
		return;
	}

	await Bun.write(path.join(agentVersion, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
}

async function smokeInstalled(prefix: string): Promise<void> {
	if (skipSmoke || isDryRun) return;

	const ompBin = path.join(prefix, "bin", "omp");
	if (!(await pathExists(ompBin))) {
		throw new Error(`Smoke check failed: ${ompBin} missing after install`);
	}

	const runtimeHome = await fs.mkdtemp(path.join(os.tmpdir(), "omp-install-local-"));
	try {
		const proc = Bun.spawn([ompBin, "--version"], {
			env: {
				...Bun.env,
				HOME: runtimeHome,
				XDG_DATA_HOME: path.join(runtimeHome, "xdg"),
			},
			stdout: "pipe",
			stderr: "pipe",
		});
		const exitCode = await proc.exited;
		const stdout = await new Response(proc.stdout).text();
		if (exitCode !== 0) {
			const stderr = await new Response(proc.stderr).text();
			throw new Error(`Smoke check failed (exit ${exitCode}): ${stderr || stdout}`);
		}
		console.log(`Smoke check: ${stdout.trim()}`);
	} finally {
		await fs.rm(runtimeHome, { recursive: true, force: true });
	}
}

async function main(): Promise<void> {
	const prefix = parsePrefix();
	const pkg = (await Bun.file(codingAgentPkg).json()) as { version: string };
	const version = pkg.version?.trim();
	if (!version) throw new Error(`Missing version in ${codingAgentPkg}`);

	await runProductionBuild();
	await runPostBuild(version);
	await installLayout(prefix, version);
	await smokeInstalled(prefix);

	console.log("");
	console.log("✓ Installed omp to local prefix");
	console.log(`  binary:  ${path.join(prefix, "bin", "omp")}`);
	console.log(`  alias:   ${path.join(prefix, "bin", "agent")}`);
	console.log(`  lib:     ${path.join(prefix, "lib", "omp", "natives", version)}`);
	console.log(`  libexec: ${path.join(prefix, "libexec", "omp", version)}`);
	console.log(`  agent:   ${path.join(prefix, "agent", "versions", version)}`);
	if (!process.env.PATH?.split(path.delimiter).includes(path.join(prefix, "bin"))) {
		console.log(`  ensure ${path.join(prefix, "bin")} is on your PATH`);
	}
}

await main();