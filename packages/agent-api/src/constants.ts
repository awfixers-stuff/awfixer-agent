/** Public API host for update checks, npm proxy, and install script. */
export const API_ORIGIN = "https://agent-api.awfixer.codes" as const;

/** Docs / marketing site (install may redirect here when split across hosts). */
export const SITE_ORIGIN = "https://agent.awfixer.codes" as const;

export const GITHUB_REPO = "awfixers-stuff/awfixer-agent" as const;

export const PACKAGE = "@awfixerai/agent" as const;
export const NATIVES_PACKAGE = "@awfixerai/natives" as const;

export const NPM_REGISTRY_UPSTREAM = "https://registry.npmjs.org" as const;

/** Scoped packages the update path cares about; everything else is not proxied. */
export const PROXIED_PACKAGES = new Set([PACKAGE, NATIVES_PACKAGE]);
