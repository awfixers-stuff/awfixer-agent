import type { Context } from "hono";

const INSTALL_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface GrievanceEntry {
	id: number;
	model: string;
	version: string;
	tool: string;
	report: string;
}

export interface GrievancePushBody {
	installId: string;
	platform: string;
	arch: string;
	agent: { name: string; version: string };
	entries: GrievanceEntry[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
	return typeof value === "string" && value.trim().length > 0;
}

function parseEntry(value: unknown): GrievanceEntry | null {
	if (!isRecord(value)) return null;
	if (typeof value.id !== "number" || !Number.isFinite(value.id)) return null;
	if (!isNonEmptyString(value.model)) return null;
	if (!isNonEmptyString(value.version)) return null;
	if (!isNonEmptyString(value.tool)) return null;
	if (!isNonEmptyString(value.report)) return null;
	return {
		id: value.id,
		model: value.model,
		version: value.version,
		tool: value.tool,
		report: value.report,
	};
}

export function parseGrievancePushBody(value: unknown): GrievancePushBody | null {
	if (!isRecord(value)) return null;
	if (!isNonEmptyString(value.installId) || !INSTALL_ID_RE.test(value.installId)) return null;
	if (!isNonEmptyString(value.platform)) return null;
	if (!isNonEmptyString(value.arch)) return null;
	if (!isRecord(value.agent)) return null;
	if (!isNonEmptyString(value.agent.name)) return null;
	if (!isNonEmptyString(value.agent.version)) return null;
	if (!Array.isArray(value.entries) || value.entries.length === 0) return null;

	const entries: GrievanceEntry[] = [];
	for (const entry of value.entries) {
		const parsed = parseEntry(entry);
		if (!parsed) return null;
		entries.push(parsed);
	}

	return {
		installId: value.installId,
		platform: value.platform,
		arch: value.arch,
		agent: { name: value.agent.name, version: value.agent.version },
		entries,
	};
}

function readBearerToken(authorization: string | undefined): string | null {
	if (!authorization) return null;
	const match = /^Bearer\s+(.+)$/i.exec(authorization.trim());
	if (!match) return null;
	const token = match[1]?.trim();
	return token && token.length > 0 ? token : null;
}

export function grievancesPushToken(): string | undefined {
	const token = Bun.env.GRIEVANCES_PUSH_TOKEN?.trim();
	return token && token.length > 0 ? token : undefined;
}

export function authorizeGrievancesPush(authorization: string | undefined): boolean {
	const required = grievancesPushToken();
	if (!required) return true;
	const provided = readBearerToken(authorization);
	return provided === required;
}

export async function handleGrievancesPush(c: Context): Promise<Response> {
	if (!authorizeGrievancesPush(c.req.header("authorization"))) {
		return c.json({ error: "unauthorized" }, 401);
	}

	let body: unknown;
	try {
		body = await c.req.json();
	} catch {
		return c.json({ error: "invalid_json" }, 400);
	}

	const parsed = parseGrievancePushBody(body);
	if (!parsed) {
		return c.json({ error: "invalid_payload" }, 400);
	}

	console.log(
		JSON.stringify({
			event: "grievances.push",
			installId: parsed.installId,
			platform: parsed.platform,
			arch: parsed.arch,
			agent: parsed.agent,
			entryCount: parsed.entries.length,
		}),
	);

	return c.json({ accepted: parsed.entries.length }, 200);
}
