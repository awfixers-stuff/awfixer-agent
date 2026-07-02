import { afterEach, describe, expect, it, vi } from "bun:test";
import type { SSHHost } from "@awfixerai/agent/capability/ssh";
import type { SourceMeta } from "@awfixerai/agent/capability/types";
import * as discovery from "@awfixerai/agent/discovery";
import type { ToolSession } from "@awfixerai/agent/tools";
import { loadSshTool } from "@awfixerai/agent/tools";

const SOURCE: SourceMeta = {
	provider: "test",
	providerName: "Test",
	path: "/dev/null",
	level: "user",
};

// Unique names so no persisted host-info cache file can exist for them.
const RUN_ID = `${Date.now()}-${process.pid}`;
const HOST_A: SSHHost = { name: `a-omp-test-${RUN_ID}`, host: "alpha.example.com", _source: SOURCE };
const HOST_B: SSHHost = { name: `b-omp-test-${RUN_ID}`, host: "beta.example.com", _source: SOURCE };

function mockHosts(hosts: SSHHost[]): void {
	vi.spyOn(discovery, "loadCapability").mockResolvedValue({
		items: hosts,
		all: hosts,
		warnings: [],
		providers: ["test"],
	});
}

function createSession(): ToolSession {
	return { cwd: "/tmp" } as unknown as ToolSession;
}

describe("loadSshTool description", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("returns null when no hosts are configured", async () => {
		mockHosts([]);
		expect(await loadSshTool(createSession())).toBeNull();
	});

	it("renders uncached hosts with the detecting placeholder, sorted by name, without probing", async () => {
		mockHosts([HOST_B, HOST_A]);
		const tool = await loadSshTool(createSession());
		expect(tool).not.toBeNull();
		expect(tool?.description.startsWith("Runs commands on remote hosts.")).toBe(true);
		expect(
			tool?.description.endsWith(
				`\n\nAvailable hosts:\n- ${HOST_A.name} (${HOST_A.host}) | detecting...\n- ${HOST_B.name} (${HOST_B.host}) | detecting...`,
			),
		).toBe(true);
	});
});
