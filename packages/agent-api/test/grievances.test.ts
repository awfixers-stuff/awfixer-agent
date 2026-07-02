import { afterEach, describe, expect, it } from "bun:test";
import app from "../server";
import { authorizeGrievancesPush, parseGrievancePushBody } from "../src/grievances";

const validPayload = {
	installId: "550e8400-e29b-41d4-a716-446655440000",
	platform: "linux",
	arch: "x64",
	agent: { name: "agent", version: "16.2.5" },
	entries: [{ id: 1, model: "anthropic/claude-sonnet-4-6", version: "16.2.5", tool: "bash", report: "timeout" }],
};

describe("grievances payload parsing", () => {
	it("accepts a valid push body", () => {
		expect(parseGrievancePushBody(validPayload)).toEqual(validPayload);
	});

	it("rejects malformed payloads", () => {
		expect(parseGrievancePushBody(null)).toBeNull();
		expect(parseGrievancePushBody({ ...validPayload, installId: "not-a-uuid" })).toBeNull();
		expect(parseGrievancePushBody({ ...validPayload, entries: [] })).toBeNull();
	});
});

describe("grievances auth", () => {
	const original = Bun.env.GRIEVANCES_PUSH_TOKEN;

	afterEach(() => {
		if (original === undefined) delete Bun.env.GRIEVANCES_PUSH_TOKEN;
		else Bun.env.GRIEVANCES_PUSH_TOKEN = original;
	});

	it("allows unauthenticated pushes when no server token is configured", () => {
		delete Bun.env.GRIEVANCES_PUSH_TOKEN;
		expect(authorizeGrievancesPush(undefined)).toBe(true);
	});

	it("requires bearer token when GRIEVANCES_PUSH_TOKEN is set", () => {
		Bun.env.GRIEVANCES_PUSH_TOKEN = "secret";
		expect(authorizeGrievancesPush(undefined)).toBe(false);
		expect(authorizeGrievancesPush("Bearer wrong")).toBe(false);
		expect(authorizeGrievancesPush("Bearer secret")).toBe(true);
	});
});

describe("grievances route", () => {
	const original = Bun.env.GRIEVANCES_PUSH_TOKEN;

	afterEach(() => {
		if (original === undefined) delete Bun.env.GRIEVANCES_PUSH_TOKEN;
		else Bun.env.GRIEVANCES_PUSH_TOKEN = original;
	});

	it("accepts valid grievance batches", async () => {
		delete Bun.env.GRIEVANCES_PUSH_TOKEN;
		const response = await app.request("http://localhost/v1/grievances", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(validPayload),
		});
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ accepted: 1 });
	});

	it("rejects invalid payloads", async () => {
		const response = await app.request("http://localhost/v1/grievances", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ installId: "bad" }),
		});
		expect(response.status).toBe(400);
	});

	it("returns 401 when token is required but missing", async () => {
		Bun.env.GRIEVANCES_PUSH_TOKEN = "secret";
		const response = await app.request("http://localhost/v1/grievances", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(validPayload),
		});
		expect(response.status).toBe(401);
	});
});
