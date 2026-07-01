package io.ohmypi.agentcompanion.domain

/**
 * Future contract for live agent control (steer / abort / session list).
 * No OMP HTTP control server exists yet — see docs/superpowers/specs/2026-07-01-android-app-design.md.
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
    suspend fun refresh(): ControlState
    suspend fun steer(sessionId: String, message: String): Result<Unit>
    suspend fun abort(sessionId: String): Result<Unit>
}