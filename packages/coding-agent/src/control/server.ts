import { parseBind } from "@awfixerai/ai/utils/parse-bind";
import { logger } from "@awfixerai/utils";
import { DEFAULT_CONTROL_BIND } from "./constants";
import { controlCorsHeaders, controlJson, isControlAuthorized, resolveControlClientIp, withControlCors } from "./http";
import { isPrivateLanClientIp } from "./lan";
import { ControlSessionNotFoundError, ControlSessionRegistry } from "./registry";

export interface StartControlServerOptions {
	bind?: string;
	bearerTokens?: readonly string[];
	lanOnly?: boolean;
	registry?: ControlSessionRegistry;
}

export interface ControlServerHandle {
	url: string;
	port: number;
	hostname: string;
	registry: ControlSessionRegistry;
	stop(): void;
}

export function startControlServer(opts: StartControlServerOptions = {}): ControlServerHandle {
	const bind = parseBind(opts.bind ?? DEFAULT_CONTROL_BIND);
	const registry = opts.registry ?? new ControlSessionRegistry();
	const tokens = new Set(opts.bearerTokens ?? []);
	const lanOnly = opts.lanOnly ?? bind.hostname === "0.0.0.0";

	const server = Bun.serve({
		hostname: bind.hostname,
		port: bind.port,
		async fetch(req): Promise<Response> {
			const url = new URL(req.url);
			const pathname = url.pathname;

			if (req.method === "OPTIONS") {
				return new Response(null, { status: 204, headers: controlCorsHeaders() });
			}

			try {
				if (req.method === "GET" && pathname === "/healthz") {
					return withControlCors(controlJson(200, { ok: true }));
				}

				if (lanOnly && !isPrivateLanClientIp(resolveControlClientIp(req))) {
					return withControlCors(controlJson(403, { error: "forbidden: client not on LAN" }));
				}

				if (!isControlAuthorized(req, tokens)) {
					return withControlCors(controlJson(401, { error: "unauthorized" }));
				}

				if (req.method === "GET" && pathname === "/api/sessions") {
					return withControlCors(controlJson(200, { sessions: registry.listSummaries() }));
				}

				const steerMatch = pathname.match(/^\/api\/sessions\/([^/]+)\/steer$/);
				if (steerMatch && req.method === "POST") {
					const sessionId = decodeURIComponent(steerMatch[1]);
					return withControlCors(await handleSteer(registry, req, sessionId));
				}

				const abortMatch = pathname.match(/^\/api\/sessions\/([^/]+)\/abort$/);
				if (abortMatch && req.method === "POST") {
					const sessionId = decodeURIComponent(abortMatch[1]);
					return withControlCors(await handleAbort(registry, sessionId));
				}

				const eventsMatch = pathname.match(/^\/api\/sessions\/([^/]+)\/events$/);
				if (eventsMatch && req.method === "GET") {
					return withControlCors(controlJson(501, { error: "SSE not implemented" }));
				}

				const sessionMatch = pathname.match(/^\/api\/sessions\/([^/]+)$/);
				if (sessionMatch && req.method === "GET") {
					const sessionId = decodeURIComponent(sessionMatch[1]);
					const status = registry.getStatus(sessionId);
					if (!status) return withControlCors(controlJson(404, { error: "session not found" }));
					return withControlCors(controlJson(200, status));
				}

				return withControlCors(controlJson(404, { error: "not found" }));
			} catch (error) {
				logger.error("Control server error", { error: String(error) });
				return withControlCors(controlJson(500, { error: "internal error" }));
			}
		},
	});

	const hostname = server.hostname ?? bind.hostname;
	const port = server.port ?? bind.port;
	return {
		url: `http://${hostname}:${port}`,
		port,
		hostname,
		registry,
		stop() {
			server.stop(true);
		},
	};
}

async function handleSteer(registry: ControlSessionRegistry, req: Request, sessionId: string): Promise<Response> {
	let body: { message?: string };
	try {
		body = (await req.json()) as { message?: string };
	} catch {
		return controlJson(400, { error: "invalid JSON body" });
	}
	const message = body.message?.trim();
	if (!message) return controlJson(400, { error: "message is required" });
	try {
		await registry.steer(sessionId, message);
		return controlJson(200, { ok: true });
	} catch (err) {
		if (err instanceof ControlSessionNotFoundError) return controlJson(404, { error: "session not found" });
		throw err;
	}
}

async function handleAbort(registry: ControlSessionRegistry, sessionId: string): Promise<Response> {
	try {
		await registry.abort(sessionId);
		return controlJson(200, { ok: true });
	} catch (err) {
		if (err instanceof ControlSessionNotFoundError) return controlJson(404, { error: "session not found" });
		throw err;
	}
}
