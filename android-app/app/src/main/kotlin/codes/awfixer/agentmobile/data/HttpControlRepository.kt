package codes.awfixer.agentmobile.data

import codes.awfixer.agentmobile.domain.ControlRepository
import codes.awfixer.agentmobile.domain.ControlState
import codes.awfixer.agentmobile.domain.LiveSessionSummary

class HttpControlRepository(private val api: ControlApi) : ControlRepository {
    override suspend fun refresh(settings: AppSettings): ControlState {
        return try {
            val baseUrl = controlBaseUrl(settings.baseUrl)
            val response = api.fetchSessions(baseUrl, settings.bearerOrNull())
            ControlState.Online(
                sessions = response.sessions.map {
                    LiveSessionSummary(id = it.id, label = it.label, state = it.state)
                },
            )
        } catch (_: java.net.ConnectException) {
            ControlState.Offline
        } catch (_: java.net.UnknownHostException) {
            ControlState.Offline
        } catch (e: ControlApiException) {
            ControlState.Error(e.message ?: "Control API error")
        } catch (e: Exception) {
            ControlState.Error(e.message ?: "Control API error")
        }
    }

    override suspend fun steer(settings: AppSettings, sessionId: String, message: String): Result<Unit> =
        runCatching {
            api.steer(controlBaseUrl(settings.baseUrl), sessionId, message, settings.bearerOrNull())
        }

    override suspend fun abort(settings: AppSettings, sessionId: String): Result<Unit> =
        runCatching {
            api.abort(controlBaseUrl(settings.baseUrl), sessionId, settings.bearerOrNull())
        }

    private fun AppSettings.bearerOrNull(): String? = bearerToken.takeIf { it.isNotBlank() }
}