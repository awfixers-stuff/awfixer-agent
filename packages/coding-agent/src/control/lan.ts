/** True when `hostname` is loopback, RFC1918, or a `.local` mDNS name. */
export function isPrivateLanHost(hostname: string): boolean {
	const lower = hostname.toLowerCase();
	if (lower === "localhost" || lower === "127.0.0.1" || lower === "0.0.0.0" || lower === "::1" || lower === "[::1]") {
		return true;
	}
	if (/^10\./.test(lower)) return true;
	if (/^192\.168\./.test(lower)) return true;
	if (/^172\.(1[6-9]|2[0-9]|3[01])\./.test(lower)) return true;
	if (lower.endsWith(".local")) return true;
	return false;
}

export function isPrivateLanClientIp(ip: string): boolean {
	const trimmed = ip.trim();
	if (!trimmed || trimmed === "unknown") return false;
	if (trimmed.startsWith("::ffff:")) {
		return isPrivateLanHost(trimmed.slice("::ffff:".length));
	}
	return isPrivateLanHost(trimmed);
}
