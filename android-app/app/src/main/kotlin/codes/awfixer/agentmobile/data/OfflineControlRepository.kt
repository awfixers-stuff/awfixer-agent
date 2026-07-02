package codes.awfixer.agentmobile.data

import codes.awfixer.agentmobile.domain.ControlRepository
import codes.awfixer.agentmobile.domain.ControlState

class OfflineControlRepository : ControlRepository {
    override suspend fun refresh(settings: AppSettings): ControlState = ControlState.Offline

    override suspend fun steer(settings: AppSettings, sessionId: String, message: String): Result<Unit> =
        Result.failure(UnsupportedOperationException("Control server not available"))

    override suspend fun abort(settings: AppSettings, sessionId: String): Result<Unit> =
        Result.failure(UnsupportedOperationException("Control server not available"))
}