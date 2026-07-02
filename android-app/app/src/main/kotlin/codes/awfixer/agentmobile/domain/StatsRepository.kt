package codes.awfixer.agentmobile.domain

import codes.awfixer.agentmobile.data.AppSettings
import codes.awfixer.agentmobile.data.StatsApi
import codes.awfixer.agentmobile.data.dto.DashboardStatsDto
import codes.awfixer.agentmobile.data.dto.MessageStatsDto
import codes.awfixer.agentmobile.data.dto.RequestDetailsDto

class StatsRepository(private val api: StatsApi) {
    suspend fun loadDashboard(settings: AppSettings): DashboardStatsDto =
        api.fetchDashboard(settings.baseUrl, settings.timeRange, settings.bearerOrNull())

    suspend fun loadRecent(settings: AppSettings, limit: Int = 50): List<MessageStatsDto> =
        api.fetchRecent(settings.baseUrl, limit, settings.bearerOrNull())

    suspend fun loadErrors(settings: AppSettings, limit: Int = 50): List<MessageStatsDto> =
        api.fetchErrors(settings.baseUrl, limit, settings.bearerOrNull())

    suspend fun loadRequestDetails(settings: AppSettings, id: Int): RequestDetailsDto =
        api.fetchRequestDetails(settings.baseUrl, id, settings.bearerOrNull())

    suspend fun sync(settings: AppSettings) =
        api.syncSessions(settings.baseUrl, settings.bearerOrNull())

    private fun AppSettings.bearerOrNull(): String? = bearerToken.takeIf { it.isNotBlank() }
}