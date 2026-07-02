import type { AgentSession } from "../session/agent-session";
import { USER_INTERRUPT_LABEL } from "../session/messages";
import { type ControlSessionHandle, type ControlSessionStatus, deriveControlSessionState } from "./types";

export function buildStatusFromAgentSession(session: AgentSession): ControlSessionStatus {
	const isStreaming = session.isStreaming;
	const isCompacting = session.isCompacting;
	const model = session.model;
	return {
		id: session.sessionId,
		label: session.sessionName ?? session.sessionId,
		state: deriveControlSessionState(isStreaming, isCompacting),
		isStreaming,
		isCompacting,
		queuedMessageCount: session.queuedMessageCount,
		messageCount: session.messages.length,
		sessionFile: session.sessionFile,
		model: model ? { provider: model.provider, id: model.id } : undefined,
	};
}

export function createLocalControlHandle(session: AgentSession): ControlSessionHandle {
	return {
		sessionId: session.sessionId,
		getSummary() {
			const status = buildStatusFromAgentSession(session);
			return { id: status.id, label: status.label, state: status.state };
		},
		getStatus() {
			return buildStatusFromAgentSession(session);
		},
		async steer(message: string) {
			await session.steer(message);
		},
		async abort() {
			await session.abort({ reason: USER_INTERRUPT_LABEL });
		},
	};
}
