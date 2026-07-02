import type { ControlSessionHandle, ControlSessionStatus, ControlSessionSummary } from "./types";

export class ControlSessionRegistry {
	#sessions = new Map<string, ControlSessionHandle>();

	register(handle: ControlSessionHandle): void {
		this.#sessions.set(handle.sessionId, handle);
	}

	unregister(sessionId: string): void {
		this.#sessions.delete(sessionId);
	}

	get(sessionId: string): ControlSessionHandle | undefined {
		return this.#sessions.get(sessionId);
	}

	listSummaries(): ControlSessionSummary[] {
		return [...this.#sessions.values()].map(handle => handle.getSummary());
	}

	getStatus(sessionId: string): ControlSessionStatus | undefined {
		return this.#sessions.get(sessionId)?.getStatus();
	}

	async steer(sessionId: string, message: string): Promise<void> {
		const handle = this.#sessions.get(sessionId);
		if (!handle) throw new ControlSessionNotFoundError(sessionId);
		await handle.steer(message);
	}

	async abort(sessionId: string): Promise<void> {
		const handle = this.#sessions.get(sessionId);
		if (!handle) throw new ControlSessionNotFoundError(sessionId);
		await handle.abort();
	}

	clear(): void {
		this.#sessions.clear();
	}
}

export class ControlSessionNotFoundError extends Error {
	constructor(sessionId: string) {
		super(`Session not found: ${sessionId}`);
		this.name = "ControlSessionNotFoundError";
	}
}
