import {
	type ControlModelRef,
	type ControlSessionStatus,
	type ControlSessionSummary,
	deriveControlSessionState,
} from "./types";

export type ControlSocketInbound =
	| {
			type: "attach";
			sessionId: string;
			label: string;
			isStreaming: boolean;
			isCompacting: boolean;
			queuedMessageCount: number;
			messageCount: number;
			sessionFile?: string;
			model?: ControlModelRef;
	  }
	| {
			type: "status";
			sessionId: string;
			label: string;
			isStreaming: boolean;
			isCompacting: boolean;
			queuedMessageCount: number;
			messageCount: number;
			sessionFile?: string;
			model?: ControlModelRef;
	  }
	| { type: "detach"; sessionId: string }
	| { type: "result"; id: string; ok: boolean; error?: string };

export type ControlSocketOutbound =
	| { type: "command"; id: string; op: "steer" | "abort"; sessionId: string; message?: string }
	| { type: "error"; message: string };

export function statusFromSocketPayload(
	payload: Extract<ControlSocketInbound, { type: "attach" } | { type: "status" }>,
): ControlSessionStatus {
	return {
		id: payload.sessionId,
		label: payload.label,
		state: deriveControlSessionState(payload.isStreaming, payload.isCompacting),
		isStreaming: payload.isStreaming,
		isCompacting: payload.isCompacting,
		queuedMessageCount: payload.queuedMessageCount,
		messageCount: payload.messageCount,
		sessionFile: payload.sessionFile,
		model: payload.model,
	};
}

export function summaryFromStatus(status: ControlSessionStatus): ControlSessionSummary {
	return { id: status.id, label: status.label, state: status.state };
}

export function encodeSocketLine(message: ControlSocketInbound | ControlSocketOutbound): string {
	return `${JSON.stringify(message)}\n`;
}

export function parseSocketLine(line: string): ControlSocketInbound | ControlSocketOutbound | null {
	const trimmed = line.trim();
	if (!trimmed) return null;
	try {
		const value = JSON.parse(trimmed) as ControlSocketInbound | ControlSocketOutbound;
		if (!value || typeof value !== "object" || !("type" in value)) return null;
		return value;
	} catch {
		return null;
	}
}
