import { isEnoent, logger } from "@awfixerai/utils";
import type { AgentSession } from "../session/agent-session";
import { USER_INTERRUPT_LABEL } from "../session/messages";
import { getControlSocketPath } from "./constants";
import { buildStatusFromAgentSession } from "./local-handle";
import { type ControlSocketInbound, encodeSocketLine, parseSocketLine } from "./socket-protocol";

type AttachState = {
	buffer: string;
	socket: Bun.Socket<undefined>;
	unsubscribe: () => void;
	sessionId: string;
};

const activeAttachments = new Map<string, AttachState>();

/** Attach a top-level session to a running control hub, if the socket exists. */
export async function attachToControlHub(session: AgentSession): Promise<(() => void) | undefined> {
	if (activeAttachments.has(session.sessionId)) {
		return () => detachControlHub(session.sessionId);
	}
	return connectSession(session);
}

export function detachControlHub(sessionId: string): void {
	const state = activeAttachments.get(sessionId);
	if (!state) return;
	state.unsubscribe();
	sendDetach(state.socket, sessionId);
	detachSession(sessionId, state.socket);
}

async function connectSession(session: AgentSession): Promise<(() => void) | undefined> {
	if (activeAttachments.has(session.sessionId)) {
		return () => detachControlHub(session.sessionId);
	}

	const socketPath = getControlSocketPath();
	try {
		if (!(await Bun.file(socketPath).exists())) return undefined;
	} catch (err) {
		if (isEnoent(err)) return undefined;
		throw err;
	}

	const { promise, resolve, reject } = Promise.withResolvers<Bun.Socket<undefined>>();
	let settled = false;

	Bun.connect({
		unix: socketPath,
		socket: {
			open(sock) {
				if (settled) return;
				settled = true;
				resolve(sock);
			},
			data(sock, chunk) {
				handleInbound(session, sock, chunk);
			},
			close(sock) {
				detachSession(session.sessionId, sock);
			},
			error(_sock, err) {
				if (!settled) {
					settled = true;
					reject(err instanceof Error ? err : new Error(String(err)));
				}
			},
		},
	});

	let socket: Bun.Socket<undefined>;
	try {
		socket = await promise;
	} catch (err) {
		logger.debug("Control hub attach failed", { error: String(err) });
		return undefined;
	}

	const status = buildStatusFromAgentSession(session);
	const attachMessage: ControlSocketInbound = {
		type: "attach",
		sessionId: status.id,
		label: status.label,
		isStreaming: status.isStreaming,
		isCompacting: status.isCompacting,
		queuedMessageCount: status.queuedMessageCount,
		messageCount: status.messageCount,
		sessionFile: status.sessionFile,
		model: status.model,
	};
	socket.write(encodeSocketLine(attachMessage));

	const state: AttachState = {
		buffer: "",
		socket,
		sessionId: status.id,
		unsubscribe: session.subscribe(() => {
			pushStatus(session, socket);
		}),
	};
	activeAttachments.set(status.id, state);
	return () => detachControlHub(status.id);
}

function pushStatus(session: AgentSession, socket: Bun.Socket<undefined>): void {
	const status = buildStatusFromAgentSession(session);
	const message: ControlSocketInbound = {
		type: "status",
		sessionId: status.id,
		label: status.label,
		isStreaming: status.isStreaming,
		isCompacting: status.isCompacting,
		queuedMessageCount: status.queuedMessageCount,
		messageCount: status.messageCount,
		sessionFile: status.sessionFile,
		model: status.model,
	};
	try {
		socket.write(encodeSocketLine(message));
	} catch {
		// Socket closed.
	}
}

function sendDetach(socket: Bun.Socket<undefined>, sessionId: string): void {
	try {
		socket.write(encodeSocketLine({ type: "detach", sessionId }));
	} catch {
		// Socket already closed.
	}
}

function detachSession(sessionId: string, socket: Bun.Socket<undefined>): void {
	const state = activeAttachments.get(sessionId);
	if (!state || state.socket !== socket) return;
	state.unsubscribe();
	activeAttachments.delete(sessionId);
	try {
		socket.end();
	} catch {
		// Already closed.
	}
}

function handleInbound(session: AgentSession, socket: Bun.Socket<undefined>, chunk: Buffer | Uint8Array): void {
	const state = activeAttachments.get(session.sessionId);
	if (!state) return;
	state.buffer += new TextDecoder().decode(chunk);
	let newline = state.buffer.indexOf("\n");
	while (newline >= 0) {
		const line = state.buffer.slice(0, newline);
		state.buffer = state.buffer.slice(newline + 1);
		void handleCommandLine(session, socket, line);
		newline = state.buffer.indexOf("\n");
	}
}

async function handleCommandLine(session: AgentSession, socket: Bun.Socket<undefined>, line: string): Promise<void> {
	const parsed = parseSocketLine(line);
	if (parsed?.type !== "command") return;
	if (parsed.sessionId !== session.sessionId) return;

	try {
		if (parsed.op === "steer") {
			const message = parsed.message?.trim();
			if (!message) throw new Error("Steer message is required");
			await session.steer(message);
		} else if (parsed.op === "abort") {
			await session.abort({ reason: USER_INTERRUPT_LABEL });
		} else {
			throw new Error(`Unsupported control command: ${String(parsed.op)}`);
		}
		socket.write(encodeSocketLine({ type: "result", id: parsed.id, ok: true }));
	} catch (err) {
		const error = err instanceof Error ? err.message : String(err);
		socket.write(encodeSocketLine({ type: "result", id: parsed.id, ok: false, error }));
	}
}
