import * as fs from "node:fs/promises";
import { isEnoent, logger } from "@awfixerai/utils";
import { getControlSocketPath } from "./constants";
import type { ControlSessionRegistry } from "./registry";
import { RemoteControlSessionHandle, type RemoteControlSocket } from "./remote-handle";
import { parseSocketLine, statusFromSocketPayload } from "./socket-protocol";

type SocketData = {
	buffer: string;
	handles: Map<string, RemoteControlSessionHandle>;
};

export interface ControlSocketServerHandle {
	socketPath: string;
	stop(): void;
}

export async function startControlSocketServer(registry: ControlSessionRegistry): Promise<ControlSocketServerHandle> {
	const socketPath = getControlSocketPath();
	try {
		await fs.unlink(socketPath);
	} catch (err) {
		if (!isEnoent(err)) throw err;
	}
	await fs.mkdir(socketPath.slice(0, socketPath.lastIndexOf("/")), { recursive: true, mode: 0o700 });

	const listener = Bun.listen<SocketData>({
		unix: socketPath,
		socket: {
			open(socket) {
				socket.data = { buffer: "", handles: new Map() };
			},
			data(socket, chunk) {
				const conn = socket.data;
				conn.buffer += new TextDecoder().decode(chunk);
				let newline = conn.buffer.indexOf("\n");
				while (newline >= 0) {
					const line = conn.buffer.slice(0, newline);
					conn.buffer = conn.buffer.slice(newline + 1);
					handleSocketLine(registry, socket, conn, line);
					newline = conn.buffer.indexOf("\n");
				}
			},
			close(socket) {
				const conn = socket.data;
				for (const handle of conn.handles.values()) {
					registry.unregister(handle.sessionId);
					handle.dispose();
				}
				conn.handles.clear();
			},
		},
	});

	try {
		await fs.chmod(socketPath, 0o600);
	} catch {
		// Best-effort.
	}

	logger.info("Control socket listening", { socketPath });

	return {
		socketPath,
		stop() {
			listener.stop(true);
			void fs.unlink(socketPath).catch(() => {});
		},
	};
}

function socketWriter(socket: Bun.Socket<SocketData>): RemoteControlSocket {
	return {
		write(data: string) {
			socket.write(data);
		},
	};
}

function handleSocketLine(
	registry: ControlSessionRegistry,
	socket: Bun.Socket<SocketData>,
	conn: SocketData,
	line: string,
): void {
	const message = parseSocketLine(line);
	if (!message) return;

	if (message.type === "attach" || message.type === "status") {
		const status = statusFromSocketPayload(message);
		let handle = conn.handles.get(status.id);
		if (!handle && message.type === "attach") {
			handle = new RemoteControlSessionHandle(socketWriter(socket), status, () => {
				conn.handles.delete(status.id);
				registry.unregister(status.id);
			});
			conn.handles.set(status.id, handle);
			registry.register(handle);
		} else if (handle) {
			handle.updateStatus(status);
		}
		return;
	}

	if (message.type === "detach") {
		const handle = conn.handles.get(message.sessionId);
		if (handle) {
			registry.unregister(message.sessionId);
			handle.dispose();
			conn.handles.delete(message.sessionId);
		}
		return;
	}

	if (message.type === "result") {
		for (const handle of conn.handles.values()) {
			handle.handleResult(message.id, message.ok, message.error);
		}
		return;
	}
}
