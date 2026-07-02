import { GITHUB_REPO } from "./constants";

export interface GithubReleaseSummary {
	tag: string;
	version: string;
	publishedAt?: string;
}

function stripVersionPrefix(tag: string): string {
	return tag.replace(/^v/, "");
}

/**
 * Resolve the latest published version from GitHub releases.
 * Used when npm has not yet replicated a fork publish.
 */
type FetchFn = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export async function fetchGithubLatestRelease(fetchImpl: FetchFn = fetch): Promise<GithubReleaseSummary | undefined> {
	const response = await fetchImpl(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
		headers: {
			Accept: "application/vnd.github+json",
			"User-Agent": "awfixer-agent-api",
		},
	});
	if (!response.ok) return undefined;

	const data = (await response.json()) as { tag_name?: string; published_at?: string };
	const tag = data.tag_name;
	if (!tag) return undefined;

	return {
		tag,
		version: stripVersionPrefix(tag),
		publishedAt: data.published_at,
	};
}
