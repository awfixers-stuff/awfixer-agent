import { NPM_REGISTRY_UPSTREAM, PACKAGE } from "./constants";
import { fetchGithubLatestRelease } from "./github";

export interface NpmLatestManifest {
	name: string;
	version: string;
	"dist-tags": { latest: string };
}

type FetchFn = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

function encodePackagePath(packageName: string): string {
	return packageName.startsWith("@") ? packageName.replace("/", "%2F") : packageName;
}

function decodePackageSegment(segment: string): string {
	return segment.includes("%2F") ? decodeURIComponent(segment) : segment;
}

/** Parse `/@scope/pkg/latest` or `/@scope%2Fpkg/latest` into a package name. */
export function parseScopedPackagePath(pathname: string): string | undefined {
	const match = pathname.match(/^\/(@[^/]+(?:\/[^/]+|%2F[^/]+))\/latest$/);
	if (!match) return undefined;
	return decodePackageSegment(match[1]);
}

export function buildUpstreamRegistryUrl(packagePath: string): string {
	const encoded = encodePackagePath(packagePath);
	return `${NPM_REGISTRY_UPSTREAM}/${encoded}`;
}

/** Map a client registry path to the npm-encoded form registry.npmjs.org expects. */
export function toUpstreamNpmPath(pathname: string): string {
	const match = pathname.match(/^\/(@awfixerai\/[^/]+)(\/.*)?$/);
	if (!match) return pathname;
	const packageName = match[1];
	const suffix = match[2] ?? "";
	return `/${encodePackagePath(packageName)}${suffix}`;
}

export function synthesizeLatestManifest(packageName: string, version: string): NpmLatestManifest {
	return {
		name: packageName,
		version,
		"dist-tags": { latest: version },
	};
}

/**
 * Proxy a scoped npm registry request to registry.npmjs.org.
 * For `/latest` on proxied packages, fall back to GitHub release tags when npm 404s.
 */
export async function proxyNpmRequest(pathname: string, fetchImpl: FetchFn = fetch): Promise<Response> {
	if (!pathname.startsWith("/@awfixerai/")) {
		return new Response(JSON.stringify({ error: "package not found" }), {
			status: 404,
			headers: { "Content-Type": "application/json" },
		});
	}

	const latestPackage = parseScopedPackagePath(pathname);
	const isLatest = latestPackage !== undefined;

	const upstreamPath = toUpstreamNpmPath(pathname.startsWith("/") ? pathname : `/${pathname}`);
	const upstreamUrl = `${NPM_REGISTRY_UPSTREAM}${upstreamPath}`;
	const upstream = await fetchImpl(upstreamUrl, {
		headers: { Accept: "application/json" },
	});

	if (upstream.ok) {
		const body = await upstream.text();
		return new Response(body, {
			status: upstream.status,
			headers: {
				"Content-Type": upstream.headers.get("Content-Type") ?? "application/json",
				"Cache-Control": "public, max-age=60",
			},
		});
	}

	if (!isLatest || !latestPackage || upstream.status !== 404) {
		const body = await upstream.text();
		return new Response(body || JSON.stringify({ error: upstream.statusText }), {
			status: upstream.status,
			headers: { "Content-Type": "application/json" },
		});
	}

	const release = await fetchGithubLatestRelease(fetchImpl);
	if (!release) {
		return new Response(
			JSON.stringify({
				error: "not_found",
				message: `${latestPackage} is not published on npm yet and no GitHub release was found for awfixers-stuff/awfixer-agent`,
			}),
			{
				status: 404,
				headers: { "Content-Type": "application/json" },
			},
		);
	}

	const manifest = synthesizeLatestManifest(latestPackage, release.version);
	return new Response(JSON.stringify(manifest), {
		status: 200,
		headers: {
			"Content-Type": "application/json",
			"Cache-Control": "public, max-age=60",
			"X-Awfixer-Version-Source": "github-release",
		},
	});
}

/** Convenience for the primary coding-agent package latest check. */
export async function resolveCodingAgentLatestVersion(fetchImpl: FetchFn = fetch): Promise<string | undefined> {
	const upstream = await fetchImpl(`${buildUpstreamRegistryUrl(PACKAGE)}/latest`);
	if (upstream.ok) {
		const data = (await upstream.json()) as { version?: string };
		return data.version;
	}
	const release = await fetchGithubLatestRelease(fetchImpl);
	return release?.version;
}
