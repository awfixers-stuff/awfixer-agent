import packageJson from "../../package.json" with { type: "json" };

export function getOpenRouterHeaders(): Record<string, string> {
	return {
		"User-Agent": `awfixer-agent/${packageJson.version}`,
		"HTTP-Referer": "https://agent.awfixer.codes/",
		"X-OpenRouter-Title": "awfixer-agent",
		"X-OpenRouter-Categories": "cli-agent",
		"X-OpenRouter-Cache": "true",
		"X-OpenRouter-Cache-TTL": "3600",
	};
}
