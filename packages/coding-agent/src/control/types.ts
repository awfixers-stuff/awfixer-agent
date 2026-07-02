export type ControlSessionState = "streaming" | "compacting" | "idle";

export interface ControlModelRef {
	provider: string;
	id: string;
}

export interface ControlSessionSummary {
	id: string;
	label: string;
	state: ControlSessionState;
}

export interface ControlSessionStatus extends ControlSessionSummary {
	isStreaming: boolean;
	isCompacting: boolean;
	queuedMessageCount: number;
	messageCount: number;
	sessionFile?: string;
	model?: ControlModelRef;
}

export interface ControlSessionHandle {
	readonly sessionId: string;
	getSummary(): ControlSessionSummary;
	getStatus(): ControlSessionStatus;
	steer(message: string): Promise<void>;
	abort(): Promise<void>;
}

export function deriveControlSessionState(isStreaming: boolean, isCompacting: boolean): ControlSessionState {
	if (isStreaming) return "streaming";
	if (isCompacting) return "compacting";
	return "idle";
}
