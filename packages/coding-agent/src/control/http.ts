import { timingSafeEqual as nodeTimingSafeEqual } from "node:crypto";

const JSON_HEADERS = {
	"Content-Type": "application/json",
	"X-Content-Type-Options": "nosniff",
} as const;

const TOKEN_ENCODER = new TextEncoder();

export function controlJson(status: number, body: unknown): Response {
	return new Response(JSON.stringify(body) ?? "null", {
		status,
		headers: JSON_HEADERS,
	});
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
	if (a.length === b.length && typeof nodeTimingSafeEqual === "function") {
		return nodeTimingSafeEqual(a, b);
	}
	const len = Math.max(a.length, b.length);
	let diff = a.length ^ b.length;
	for (let i = 0; i < len; i++) {
		const av = (i < a.length ? a[i] : 0) | 0;
		const bv = (i < b.length ? b[i] : 0) | 0;
		diff |= av ^ bv;
	}
	return diff === 0;
}

export function isControlAuthorized(req: Request, tokens: ReadonlySet<string>): boolean {
	if (tokens.size === 0) return true;
	const header = req.headers.get("authorization");
	if (!header) return false;
	const match = header.match(/^Bearer\s+(.+)$/i);
	if (!match) return false;
	const presented = TOKEN_ENCODER.encode(match[1].trim());
	let ok = false;
	for (const tok of tokens) {
		const expected = TOKEN_ENCODER.encode(tok);
		if (timingSafeEqual(presented, expected)) ok = true;
	}
	return ok;
}

const CORS_HEADERS: Record<string, string> = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "GET, POST, OPTIONS",
	"Access-Control-Allow-Headers": "authorization, content-type",
	"Access-Control-Max-Age": "86400",
};

export function controlCorsHeaders(): Record<string, string> {
	return { ...CORS_HEADERS };
}

export function withControlCors(response: Response): Response {
	const headers = new Headers(response.headers);
	for (const [key, value] of Object.entries(controlCorsHeaders())) {
		headers.set(key, value);
	}
	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers,
	});
}

export function resolveControlClientIp(req: Request): string {
	const forwarded = req.headers.get("x-forwarded-for");
	if (forwarded) return forwarded.split(",")[0]?.trim() ?? "unknown";
	return req.headers.get("x-real-ip") ?? "unknown";
}
