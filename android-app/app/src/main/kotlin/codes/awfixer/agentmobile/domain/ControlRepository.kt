package codes.awfixer.agentmobile.domain

import codes.awfixer.agentmobile.data.AppSettings

/**
 * Live agent control (steer / abort / session list) against the HTTP control API.
 * See docs/superpowers/specs/2026-07-02-agent-control-api.md.
 */
data class LiveSessionSummary(
    val id: String,
    val label: String,
    val state: String,
)

sealed interface ControlState {
    data object Offline : ControlState
    data class Online(val sessions: List<LiveSessionSummary>) : ControlState
    data class Error(val message: String) : ControlState
}

interface ControlRepository {
    suspend fun refresh(settings: AppSettings): ControlState
    suspend fun steer(settings: AppSettings, sessionId: String, message: String): Result<Unit>
    suspend fun abort(settings: AppSettings, sessionId: String): Result<Unit>
}