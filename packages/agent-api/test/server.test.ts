import { describe, expect, it } from "bun:test";
import app from "../server";
import { API_ORIGIN, GITHUB_REPO, PACKAGE } from "../src/constants";
import { fetchGithubLatestRelease } from "../src/github";
import {
	parseScopedPackagePath,
	proxyNpmRequest,
	resolveCodingAgentLatestVersion,
	synthesizeLatestManifest,
} from "../src/npm-proxy";

describe("agent-api npm paths", () => {
	it("parses scoped /latest paths with slash or encoded slash", () => {
		expect(parseScopedPackagePath("/@awfixerai/agent/latest")).toBe(PACKAGE);
		expect(parseScopedPackagePath("/@awfixerai%2Fpi-coding-agent/latest")).toBe(PACKAGE);
		expect(parseScopedPackagePath("/@awfixerai/natives/latest")).toBe("@awfixerai/natives");
	});

	it("synthesizes npm-compatible latest manifests", () => {
		expect(synthesizeLatestManifest(PACKAGE, "16.2.5")).toEqual({
			name: PACKAGE,
			version: "16.2.5",
			"dist-tags": { latest: "16.2.5" },
		});
	});

	it("proxies npm /latest when upstream succeeds", async () => {
		const fetchImpl = async (input: string | URL | Request): Promise<Response> => {
			const url = String(input);
			if (url.endsWith("/@awfixerai%2Fpi-coding-agent/latest")) {
				return Response.json({ name: PACKAGE, version: "9.9.9", "dist-tags": { latest: "9.9.9" } });
			}
			return new Response("not found", { status: 404 });
		};

		const response = await proxyNpmRequest("/@awfixerai/agent/latest", fetchImpl);
		expect(response.status).toBe(200);
		const body = (await response.json()) as { version: string };
		expect(body.version).toBe("9.9.9");
	});

	it("falls back to GitHub release version when npm /latest is missing", async () => {
		const fetchImpl = async (input: string | URL | Request): Promise<Response> => {
			const url = String(input);
			if (url.includes("registry.npmjs.org")) {
				return new Response("not found", { status: 404 });
			}
			if (url.includes("api.github.com")) {
				return Response.json({ tag_name: "v16.2.5" });
			}
			return new Response("unexpected", { status: 500 });
		};

		const response = await proxyNpmRequest("/@awfixerai/agent/latest", fetchImpl);
		expect(response.status).toBe(200);
		expect(response.headers.get("X-Awfixer-Version-Source")).toBe("github-release");
		const body = (await response.json()) as { version: string };
		expect(body.version).toBe("16.2.5");
	});

	it("resolveCodingAgentLatestVersion prefers npm over GitHub", async () => {
		const fetchImpl = async (input: string | URL | Request): Promise<Response> => {
			const url = String(input);
			if (url.includes("registry.npmjs.org")) {
				return Response.json({ version: "1.2.3" });
			}
			if (url.includes("api.github.com")) {
				return Response.json({ tag_name: "v9.9.9" });
			}
			return new Response("unexpected", { status: 500 });
		};

		await expect(resolveCodingAgentLatestVersion(fetchImpl)).resolves.toBe("1.2.3");
	});
});

describe("agent-api routes", () => {
	it("serves install script with fork constants", async () => {
		const response = await app.request("http://localhost/install");
		expect(response.status).toBe(200);
		const text = await response.text();
		expect(text).toContain(`curl -fsSL ${API_ORIGIN}/install | sh`);
		expect(text).toContain(`REPO="${GITHUB_REPO}"`);
		expect(text).toContain(`PACKAGE="${PACKAGE}"`);
	});

	it("redirects release assets and maps agent-* to omp-* on GitHub", async () => {
		const response = await app.request("http://localhost/releases/download/v1.0.0/agent-linux-x64");
		expect(response.status).toBe(302);
		expect(response.headers.get("Location")).toBe(
			`https://github.com/${GITHUB_REPO}/releases/download/v1.0.0/agent-linux-x64`,
		);
	});

	it("exposes health and service metadata", async () => {
		const health = await app.request("http://localhost/healthz");
		expect(health.status).toBe(200);
		expect(await health.json()).toEqual({ ok: true });

		const root = await app.request("http://localhost/");
		expect(root.status).toBe(200);
		const manifest = (await root.json()) as { repo: string };
		expect(manifest.repo).toBe(GITHUB_REPO);
	});
});

describe("github release helper", () => {
	it("strips a leading v from release tags", async () => {
		const fetchImpl = async (): Promise<Response> => Response.json({ tag_name: "v3.4.5" });
		await expect(fetchGithubLatestRelease(fetchImpl)).resolves.toEqual({
			tag: "v3.4.5",
			version: "3.4.5",
			publishedAt: undefined,
		});
	});
});
