import { afterEach, describe, expect, it } from "bun:test";
import { createLocalControlHandle } from "@awfixerai/agent/control/local-handle";
import { ControlSessionRegistry } from "@awfixerai/agent/control/registry";
import { startControlServer } from "@awfixerai/agent/control/server";
import type { ControlSessionHandle } from "@awfixerai/agent/control/types";

function createMockHandle(input: {
	id?: string;
	label?: string;
	isStreaming?: boolean;
	isCompacting?: boolean;
}): ControlSessionHandle & { steerCalls: string[]; abortCalls: number } {
	const steerCalls: string[] = [];
	let abortCalls = 0;
	const id = input.id ?? "sess-test-1";
	const label = input.label ?? "feature-branch";
	const isStreaming = input.isStreaming ?? false;
	const isCompacting = input.isCompacting ?? false;
	return {
		sessionId: id,
		steerCalls,
		get abortCalls() {
			return abortCalls;
		},
		getSummary() {
			return {
				id,
				label,
				state: isStreaming ? "streaming" : isCompacting ? "compacting" : "idle",
			};
		},
		getStatus() {
			return {
				id,
				label,
				state: isStreaming ? "streaming" : isCompacting ? "compacting" : "idle",
				isStreaming,
				isCompacting,
				queuedMessageCount: 0,
				messageCount: 3,
			};
		},
		async steer(message: string) {
			steerCalls.push(message);
		},
		async abort() {
			abortCalls += 1;
		},
	};
}

describe("control HTTP API", () => {
	const servers: Array<{ stop(): void }> = [];

	afterEach(() => {
		for (const server of servers.splice(0)) server.stop();
	});

	function startTestServer(handles: ControlSessionHandle[], token = "test-token") {
		const registry = new ControlSessionRegistry();
		for (const handle of handles) registry.register(handle);
		const server = startControlServer({
			bind: "127.0.0.1:0",
			bearerTokens: [token],
			lanOnly: false,
			registry,
		});
		servers.push(server);
		return server;
	}

	it("lists no sessions when registry is empty", async () => {
		const server = startTestServer([]);
		const response = await fetch(`${server.url}/api/sessions`, {
			headers: { Authorization: "Bearer test-token" },
		});
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ sessions: [] });
	});

	it("lists registered session summaries", async () => {
		const handle = createMockHandle({ isStreaming: true });
		const server = startTestServer([handle]);
		const response = await fetch(`${server.url}/api/sessions`, {
			headers: { Authorization: "Bearer test-token" },
		});
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			sessions: [{ id: "sess-test-1", label: "feature-branch", state: "streaming" }],
		});
	});

	it("returns session status and 404 for unknown ids", async () => {
		const handle = createMockHandle({});
		const server = startTestServer([handle]);
		const ok = await fetch(`${server.url}/api/sessions/sess-test-1`, {
			headers: { Authorization: "Bearer test-token" },
		});
		expect(ok.status).toBe(200);
		expect(await ok.json()).toMatchObject({ id: "sess-test-1", state: "idle", messageCount: 3 });

		const missing = await fetch(`${server.url}/api/sessions/missing`, {
			headers: { Authorization: "Bearer test-token" },
		});
		expect(missing.status).toBe(404);
	});

	it("steers and aborts through HTTP", async () => {
		const handle = createMockHandle({});
		const server = startTestServer([handle]);

		const steer = await fetch(`${server.url}/api/sessions/sess-test-1/steer`, {
			method: "POST",
			headers: {
				Authorization: "Bearer test-token",
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ message: "Pause and summarize." }),
		});
		expect(steer.status).toBe(200);
		expect(await steer.json()).toEqual({ ok: true });
		expect(handle.steerCalls).toEqual(["Pause and summarize."]);

		const abort = await fetch(`${server.url}/api/sessions/sess-test-1/abort`, {
			method: "POST",
			headers: { Authorization: "Bearer test-token" },
		});
		expect(abort.status).toBe(200);
		expect(await abort.json()).toEqual({ ok: true });
		expect(handle.abortCalls).toBe(1);
	});

	it("rejects steer without message and unauthorized requests", async () => {
		const handle = createMockHandle({});
		const server = startTestServer([handle]);

		const badBody = await fetch(`${server.url}/api/sessions/sess-test-1/steer`, {
			method: "POST",
			headers: {
				Authorization: "Bearer test-token",
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ message: "   " }),
		});
		expect(badBody.status).toBe(400);

		const unauthorized = await fetch(`${server.url}/api/sessions`);
		expect(unauthorized.status).toBe(401);
	});

	it("answers OPTIONS with CORS headers", async () => {
		const server = startTestServer([]);
		const response = await fetch(`${server.url}/api/sessions`, { method: "OPTIONS" });
		expect(response.status).toBe(204);
		expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
	});

	it("maps AgentSession fields through createLocalControlHandle", () => {
		const session = {
			sessionId: "abc",
			sessionName: "demo",
			isStreaming: false,
			isCompacting: true,
			queuedMessageCount: 2,
			messages: [{}, {}, {}],
			sessionFile: "/tmp/session.jsonl",
			model: { provider: "anthropic", id: "claude" },
			async steer() {},
			async abort() {},
		};
		const handle = createLocalControlHandle(session as never);
		expect(handle.getStatus()).toMatchObject({
			id: "abc",
			label: "demo",
			state: "compacting",
			queuedMessageCount: 2,
			model: { provider: "anthropic", id: "claude" },
		});
	});
});
