package io.ohmypi.agentcompanion.data

import io.ohmypi.agentcompanion.domain.ControlRepository
import io.ohmypi.agentcompanion.domain.ControlState

class OfflineControlRepository : ControlRepository {
    override suspend fun refresh(): ControlState = ControlState.Offline

    override suspend fun steer(sessionId: String, message: String): Result<Unit> =
        Result.failure(UnsupportedOperationException("Control server not available"))

    override suspend fun abort(sessionId: String): Result<Unit> =
        Result.failure(UnsupportedOperationException("Control server not available"))
}