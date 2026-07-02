#!/usr/bin/env bun
/**
 * Follow-up sweep: update user-facing docs to awfixer-agent branding.
 * Skips CHANGELOG.md (released sections are immutable) and transition-docs/.
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";

const repoRoot = path.join(import.meta.dir, "..");

const PACKAGE_REPLACEMENTS: readonly [string, string][] = [
	["@oh-my-pi/pi-coding-agent", "@awfixerai/agent"],
	["@oh-my-pi/pi-agent-core", "@awfixerai/agent-core"],
	["@oh-my-pi/pi-mnemopi", "@awfixerai/mnemopi"],
	["@oh-my-pi/pi-catalog", "@awfixerai/catalog"],
	["@oh-my-pi/pi-natives", "@awfixerai/natives"],
	["@oh-my-pi/pi-utils", "@awfixerai/utils"],
	["@oh-my-pi/pi-wire", "@awfixerai/wire"],
	["@oh-my-pi/pi-tui", "@awfixerai/tui"],
	["@oh-my-pi/pi-ai", "@awfixerai/ai"],
	["@oh-my-pi/omp-stats", "@awfixerai/stats"],
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
	["@awfixerai/pi-agent", "@awfixerai/agent-core"],
	["@oh-my-pi/pi-agent", "@awfixerai/agent-core"],
];

const TEXT_REPLACEMENTS: readonly [string, string][] = [
	["can1357/oh-my-pi", "awfixers-stuff/awfixer-agent"],
	["https://github.com/can1357/oh-my-pi", "https://github.com/awfixers-stuff/awfixer-agent"],
	["https://omp.sh", "https://agent.awfixer.codes"],
	["oh-my-pi/pi:dev", "awfixer-agent/agent:dev"],
	["oh-my-pi", "awfixer-agent"],
	["$XDG_DATA_HOME/omp", "$XDG_DATA_HOME/agent"],
	["$XDG_STATE_HOME/omp", "$XDG_STATE_HOME/agent"],
	["$XDG_CACHE_HOME/omp", "$XDG_CACHE_HOME/agent"],
	["~/.omp/logs", "~/.agent/logs"],
	["~/.omp/agent", "~/.agent"],
	["~/.omp/", "~/.agent/"],
	["~/.omp", "~/.agent"],
	["OMP_PROFILE", "AGENT_PROFILE"],
	["OMP_AGENT_DIR", "AGENT_DIR"],
	["OMP_REPO", "AGENT_REPO"],
	["PI_CODING_AGENT_DIR", "AGENT_DIR"],
	["PI_COMPILED", "AGENT_COMPILED"],
	["PI_CONFIG_DIR", "AGENT_CONFIG_DIR"],
	["omp-darwin-", "agent-darwin-"],
	["omp-linux-", "agent-linux-"],
	["omp-windows-", "agent-windows-"],
	["omp-coding-agent", "@awfixerai/agent"],
	["omp-python-runner", "agent-python-runner"],
	["~/omp-signing", "~/agent-signing"],
	["omp-auth-gateway", "agent-auth-gateway"],
	["omp-team-key", "agent-team-key"],
	["OMP-native", "agent-native"],
	["OMP-managed", "agent-managed"],
	["Claude/OMP", "Claude/agent"],
	["omp-only", "agent-only"],
	["omp's ", "agent's "],
	["omp RPC", "agent RPC"],
	["omp-RPC", "agent-RPC"],
];

/** CLI command `omp` → `agent`, preserving project config `.omp`. */
function replaceCliOmp(text: string): string {
	return text
		.replace(/`omp`/g, "`agent`")
		.replace(/\bomp --/g, "agent --")
		.replace(/\bomp auth-broker\b/g, "agent auth-broker")
		.replace(/\bomp setup\b/g, "agent setup")
		.replace(/\bomp on\(/g, "api.on(")
		.replace(/\bomp stats\b/g, "agent stats")
		.replace(/\bomp login\b/g, "agent login")
		.replace(/\bomp update\b/g, "agent update")
		.replace(/\bomp migrate-config\b/g, "agent migrate-config")
		.replace(/\bomp config\b/g, "agent config")
		.replace(/\bomp install\b/g, "agent install")
		.replace(/\bomp completions\b/g, "agent completions")
		.replace(/\bomp mcp\b/g, "agent mcp")
		.replace(/\bomp acp\b/g, "agent acp")
		.replace(/\bomp rpc\b/g, "agent rpc")
		.replace(/\bomp debug\b/g, "agent debug")
		.replace(/\bomp export\b/g, "agent export")
		.replace(/\bomp import\b/g, "agent import")
		.replace(/\bomp resume\b/g, "agent resume")
		.replace(/\bomp fork\b/g, "agent fork")
		.replace(/\bomp share\b/g, "agent share")
		.replace(/\bomp join\b/g, "agent join")
		.replace(/\bomp collab\b/g, "agent collab")
		.replace(/\bomp eval\b/g, "agent eval")
		.replace(/\bomp bench\b/g, "agent bench")
		.replace(/\bomp version\b/g, "agent version")
		.replace(/\bomp help\b/g, "agent help")
		.replace(/\bomp dev\b/g, "agent dev")
		.replace(/\bRun omp\b/g, "Run agent")
		.replace(/\brun omp\b/g, "run agent")
		.replace(/\bthe omp CLI\b/g, "the agent CLI")
		.replace(/\bthe omp binary\b/g, "the agent binary")
		.replace(/\bomp CLI\b/g, "agent CLI")
		.replace(/\bomp binary\b/g, "agent binary")
		.replace(/\bomp process\b/g, "agent process")
		.replace(/\bomp instance\b/g, "agent instance")
		.replace(/\bomp session\b/g, "agent session")
		.replace(/\bomp TUI\b/g, "agent TUI")
		.replace(/\bomp prompt\b/g, "agent prompt")
		.replace(/\bomp client\b/g, "agent client")
		.replace(/\bomp instances\b/g, "agent instances")
		.replace(/\bomp build\b/g, "agent build")
		.replace(/\bomp tarball\b/g, "agent tarball")
		.replace(/\blocal omp\b/gi, "local agent")
		.replace(/\bFrom another omp\b/g, "From another agent")
		.replace(/\bconfigured in omp\b/g, "configured in agent")
		.replace(/\bthrough omp's\b/g, "through agent's")
		.replace(/\bomp extracts\b/g, "agent extracts")
		.replace(/\bfor omp collab\b/g, "for agent collab")
		.replace(/\bomp coding agent\b/gi, "awfixer-agent")
		.replace(/\boh-my-pi coding agent\b/gi, "awfixer-agent")
		.replace(/\bOMP coding agent\b/g, "awfixer-agent")
		.replace(/# omp\b/g, "# agent")
		.replace(/\$ omp\b/g, "$ agent")
		.replace(/^omp$/gm, "agent");
}

const ROOTS = [
	path.join(repoRoot, "docs"),
	path.join(repoRoot, "AGENTS.md"),
	path.join(repoRoot, "packages", "coding-agent", "README.md"),
	path.join(repoRoot, "packages", "utils", "README.md"),
	path.join(repoRoot, "packages", "agent", "README.md"),
	path.join(repoRoot, "packages", "ai", "README.md"),
	path.join(repoRoot, "packages", "catalog", "README.md"),
	path.join(repoRoot, "packages", "natives", "README.md"),
	path.join(repoRoot, "packages", "snapcompact", "README.md"),
	path.join(repoRoot, "packages", "swarm-extension", "README.md"),
	path.join(repoRoot, "packages", "collab-web", "README.md"),
	path.join(repoRoot, "packages", "collab-web", "index.html"),
	path.join(repoRoot, "packages", "collab-web", "public"),
	path.join(repoRoot, "python", "autoawfixer", "README.md"),
	path.join(repoRoot, "python", "autoawfixer", "docs"),
	path.join(repoRoot, "android-app", "README.md"),
	path.join(repoRoot, "github-app", "README.md"),
	path.join(repoRoot, "github-app", "worker", "README.md"),
	path.join(repoRoot, "packages", "stats", "README.md"),
	path.join(repoRoot, "packages", "terminal-bench", "README.md"),
	path.join(repoRoot, "packages", "wire", "README.md"),
	path.join(repoRoot, "packages", "tui", "README.md"),
	path.join(repoRoot, "packages", "mnemopi", "README.md"),
	path.join(repoRoot, "packages", "coding-agent", "examples"),
	path.join(repoRoot, "scripts", "session-stats", "README.md"),
	path.join(repoRoot, "python", "omp-rpc", "README.md"),
	path.join(repoRoot, "python", "autoawfixer", "AGENTS.md"),
	path.join(repoRoot, "scripts", "session-stats"),
	path.join(repoRoot, "transition-docs", "REBRANDING.md"),
];

const EXTENSIONS = new Set([".md", ".html", ".xml", ".txt", ".ts", ".json"]);

async function walk(target: string, out: string[]): Promise<void> {
	let stat: Awaited<ReturnType<typeof fs.stat>>;
	try {
		stat = await fs.stat(target);
	} catch {
		return;
	}
	if (stat.isFile()) {
		const ext = path.extname(target).toLowerCase();
		if (EXTENSIONS.has(ext) || path.basename(target) === "AGENTS.md") out.push(target);
		return;
	}
	if (!stat.isDirectory()) return;
	const entries = await fs.readdir(target);
	for (const name of entries) {
		if (name === "CHANGELOG.md") continue;
		await walk(path.join(target, name), out);
	}
}

function apply(text: string): string {
	let out = text;
	for (const [from, to] of PACKAGE_REPLACEMENTS) out = out.split(from).join(to);
	for (const [from, to] of TEXT_REPLACEMENTS) out = out.split(from).join(to);
	out = replaceCliOmp(out);
	return out;
}

async function main(): Promise<void> {
	const files: string[] = [];
	for (const root of ROOTS) await walk(root, files);

	let changed = 0;
	for (const file of files) {
		if (file.endsWith("docs-rebrand-sweep.ts")) continue;
		const before = await fs.readFile(file, "utf8");
		const after = apply(before);
		if (after !== before) {
			await fs.writeFile(file, after);
			changed++;
		}
	}
	console.log(`docs-rebrand-sweep: updated ${changed} files`);
}

await main();