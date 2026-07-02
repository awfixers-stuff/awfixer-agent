package codes.awfixer.agentmobile.data

import codes.awfixer.agentmobile.data.dto.DashboardStatsDto
import codes.awfixer.agentmobile.data.dto.FolderStatsDto
import codes.awfixer.agentmobile.data.dto.MessageStatsDto
import codes.awfixer.agentmobile.data.dto.ModelStatsDto
import codes.awfixer.agentmobile.data.dto.RequestDetailsDto
import codes.awfixer.agentmobile.data.dto.SyncResultDto
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.engine.android.Android
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.request.post
import io.ktor.http.isSuccess
import io.ktor.serialization.kotlinx.json.json
import kotlinx.serialization.json.Json

class StatsApi {
    private val json = Json {
        ignoreUnknownKeys = true
        isLenient = true
    }

    private val client = HttpClient(Android) {
        install(ContentNegotiation) {
            json(json)
        }
    }

    suspend fun fetchDashboard(baseUrl: String, range: String, bearer: String?): DashboardStatsDto =
        get(baseUrl, "/api/stats", mapOf("range" to range), bearer)

    suspend fun fetchModels(baseUrl: String, range: String, bearer: String?): List<ModelStatsDto> =
        get(baseUrl, "/api/stats/models", mapOf("range" to range), bearer)

    suspend fun fetchFolders(baseUrl: String, range: String, bearer: String?): List<FolderStatsDto> =
        get(baseUrl, "/api/stats/folders", mapOf("range" to range), bearer)

    suspend fun fetchRecent(baseUrl: String, limit: Int, bearer: String?): List<MessageStatsDto> =
        get(baseUrl, "/api/stats/recent", mapOf("limit" to limit.toString()), bearer)

    suspend fun fetchErrors(baseUrl: String, limit: Int, bearer: String?): List<MessageStatsDto> =
        get(baseUrl, "/api/stats/errors", mapOf("limit" to limit.toString()), bearer)

    suspend fun fetchRequestDetails(baseUrl: String, id: Int, bearer: String?): RequestDetailsDto =
        get(baseUrl, "/api/request/$id", emptyMap(), bearer)

    suspend fun syncSessions(baseUrl: String, bearer: String?): SyncResultDto {
        val url = buildStatsUrl(baseUrl, "/api/sync", emptyMap())
        val response = client.post(url) {
            if (!bearer.isNullOrBlank()) header("Authorization", "Bearer $bearer")
        }
        if (!response.status.isSuccess()) {
            throw StatsApiException("Sync failed: HTTP ${response.status.value}")
        }
        return response.body()
    }

    private suspend inline fun <reified T> get(
        baseUrl: String,
        path: String,
        query: Map<String, String>,
        bearer: String?,
    ): T {
        val url = buildStatsUrl(baseUrl, path, query)
        val response = client.get(url) {
            if (!bearer.isNullOrBlank()) header("Authorization", "Bearer $bearer")
        }
        if (!response.status.isSuccess()) {
            throw StatsApiException("GET $path failed: HTTP ${response.status.value}")
        }
        return response.body()
    }
}

class StatsApiException(message: String) : Exception(message)