import { Snowflake } from "@awfixerai/utils";
import { type ControlSocketOutbound, encodeSocketLine, summaryFromStatus } from "./socket-protocol";
import type { ControlSessionHandle, ControlSessionStatus } from "./types";

const COMMAND_TIMEOUT_MS = 30_000;

type PendingCommand = {
	resolve: () => void;
	reject: (error: Error) => void;
	timer: ReturnType<typeof setTimeout>;
};

export interface RemoteControlSocket {
	write(data: string): void;
}

export class RemoteControlSessionHandle implements ControlSessionHandle {
	#status: ControlSessionStatus;
	#socket: RemoteControlSocket;
	#pending = new Map<string, PendingCommand>();
	#onDispose: () => void;

	constructor(socket: RemoteControlSocket, status: ControlSessionStatus, onDispose: () => void) {
		this.#socket = socket;
		this.#status = status;
		this.#onDispose = onDispose;
	}

	get sessionId(): string {
		return this.#status.id;
	}

	updateStatus(status: ControlSessionStatus): void {
		this.#status = status;
	}

	dispose(): void {
		for (const pending of this.#pending.values()) {
			clearTimeout(pending.timer);
			pending.reject(new Error("Control session detached"));
		}
		this.#pending.clear();
		this.#onDispose();
	}

	handleResult(id: string, ok: boolean, error?: string): void {
		const pending = this.#pending.get(id);
		if (!pending) return;
		clearTimeout(pending.timer);
		this.#pending.delete(id);
		if (ok) pending.resolve();
		else pending.reject(new Error(error ?? "Control command failed"));
	}

	getSummary() {
		return summaryFromStatus(this.#status);
	}

	getStatus() {
		return this.#status;
	}

	async steer(message: string): Promise<void> {
		await this.#sendCommand({ op: "steer", message });
	}

	async abort(): Promise<void> {
		await this.#sendCommand({ op: "abort" });
	}

	#sendCommand(input: { op: "steer" | "abort"; message?: string }): Promise<void> {
		const id = Snowflake.next() as string;
		const { promise, resolve, reject } = Promise.withResolvers<void>();
		const timer = setTimeout(() => {
			this.#pending.delete(id);
			reject(new Error(`Control ${input.op} timed out`));
		}, COMMAND_TIMEOUT_MS);
		timer.unref?.();
		this.#pending.set(id, { resolve, reject, timer });

		const outbound: ControlSocketOutbound = {
			type: "command",
			id,
			op: input.op,
			sessionId: this.sessionId,
			message: input.message,
		};
		this.#socket.write(encodeSocketLine(outbound));
		return promise;
	}
}
