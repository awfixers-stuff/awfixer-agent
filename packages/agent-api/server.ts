import { Hono } from "hono";
import { API_ORIGIN, GITHUB_REPO, NATIVES_PACKAGE, PACKAGE, SITE_ORIGIN } from "./src/constants";
import { renderInstallScript } from "./src/install-script";
import { proxyNpmRequest } from "./src/npm-proxy";

const app = new Hono();

app.get("/", c =>
	c.json({
		service: "awfixer-agent-api",
		domain: API_ORIGIN,
		site: SITE_ORIGIN,
		repo: GITHUB_REPO,
		endpoints: {
			health: "/healthz",
			install: "/install",
			latestCodingAgent: `/@awfixerai/agent/latest`,
			latestNatives: `/@awfixerai/natives/latest`,
			releaseAsset: "/releases/download/:tag/:asset",
		},
		packages: {
			codingAgent: PACKAGE,
			natives: NATIVES_PACKAGE,
		},
	}),
);

app.get("/healthz", c => c.json({ ok: true }));

app.get("/install", c =>
	c.text(renderInstallScript(), 200, {
		"Content-Type": "text/plain; charset=utf-8",
	}),
);

app.get("/releases/download/:tag/:asset", c => {
	const { tag, asset } = c.req.param();
	// Release pipeline still publishes omp-* asset names while APP_NAME is agent.
	const githubAsset = asset.startsWith("agent-") ? asset.replace(/^agent-/, "omp-") : asset;
	const target = `https://github.com/${GITHUB_REPO}/releases/download/${tag}/${githubAsset}`;
	return c.redirect(target, 302);
});

/** npm registry-compatible paths for @awfixerai/* (proxy + GitHub /latest fallback). */
app.all("/@awfixerai/*", async c => proxyNpmRequest(c.req.path));

export default app;

if (import.meta.main) {
	const port = Number(Bun.env.PORT ?? 8787);
	Bun.serve({ port, fetch: app.fetch });
	console.log(`agent-api listening on http://localhost:${port}`);
}
