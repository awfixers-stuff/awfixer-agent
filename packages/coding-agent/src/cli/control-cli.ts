import { APP_NAME } from "@awfixerai/utils";
import { getControlTokenPath } from "../control/constants";
import { startControlServer } from "../control/server";
import { startControlSocketServer } from "../control/socket-server";
import { ensureControlToken, readControlToken, regenerateControlToken } from "../control/token";

export type ControlCommandAction = "serve" | "token";

export interface ControlCommandArgs {
	action: ControlCommandAction;
	flags: {
		bind?: string;
		noAuth?: boolean;
		lanOnly?: boolean;
		noLanOnly?: boolean;
		regenerate?: boolean;
	};
}

export async function runControlCommand(cmd: ControlCommandArgs): Promise<void> {
	switch (cmd.action) {
		case "serve":
			await runControlServe(cmd.flags);
			return;
		case "token":
			await runControlToken(cmd.flags);
			return;
	}
}

async function runControlServe(flags: ControlCommandArgs["flags"]): Promise<void> {
	const bearerToken = flags.noAuth ? null : await ensureControlToken();
	const http = startControlServer({
		bind: flags.bind,
		bearerTokens: bearerToken ? [bearerToken] : [],
		lanOnly: flags.noLanOnly ? false : flags.lanOnly,
	});
	const socket = await startControlSocketServer(http.registry);

	process.stdout.write(`${APP_NAME} control listening on ${http.url}\n`);
	process.stdout.write(`control socket: ${socket.socketPath}\n`);
	if (bearerToken) {
		process.stdout.write(`bearer token file: ${getControlTokenPath()}\n`);
	} else {
		process.stdout.write("auth: disabled (--no-auth)\n");
	}
	process.stdout.write("Press Ctrl+C to stop\n");

	const stopped = Promise.withResolvers<void>();
	let shuttingDown = false;
	const shutdown = (signal: NodeJS.Signals) => {
		if (shuttingDown) return;
		shuttingDown = true;
		process.stdout.write(`\nShutting down (${signal})...\n`);
		http.stop();
		socket.stop();
		stopped.resolve();
	};
	process.once("SIGINT", shutdown);
	process.once("SIGTERM", shutdown);
	await stopped.promise;
}

async function runControlToken(flags: ControlCommandArgs["flags"]): Promise<void> {
	const token = flags.regenerate ? await regenerateControlToken() : await ensureControlToken();
	const existing = await readControlToken();
	if (!flags.regenerate && existing) {
		process.stdout.write(`${token}\n`);
		return;
	}
	process.stdout.write(`${token}\n`);
}
