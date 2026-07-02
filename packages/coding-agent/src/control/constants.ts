import * as path from "node:path";
import { getConfigRootDir } from "@awfixerai/utils";

export const DEFAULT_CONTROL_PORT = 3848;
export const DEFAULT_CONTROL_BIND = `127.0.0.1:${DEFAULT_CONTROL_PORT}`;

export function getControlSocketPath(): string {
	const fromEnv = Bun.env.AGENT_CONTROL_SOCKET?.trim();
	if (fromEnv) return fromEnv;
	return path.join(getConfigRootDir(), "control.sock");
}

export function getControlTokenPath(): string {
	return path.join(getConfigRootDir(), "control.token");
}
