package io.ohmypi.agentcompanion.data

import io.ohmypi.agentcompanion.data.dto.DashboardStatsDto
import io.ohmypi.agentcompanion.data.dto.FolderStatsDto
import io.ohmypi.agentcompanion.data.dto.MessageStatsDto
import io.ohmypi.agentcompanion.data.dto.ModelStatsDto
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
        val url = buildUrl(baseUrl, "/api/sync", emptyMap())
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
        val url = buildUrl(baseUrl, path, query)
        val response = client.get(url) {
            if (!bearer.isNullOrBlank()) header("Authorization", "Bearer $bearer")
        }
        if (!response.status.isSuccess()) {
            throw StatsApiException("GET $path failed: HTTP ${response.status.value}")
        }
        return response.body()
    }

    private fun buildUrl(baseUrl: String, path: String, query: Map<String, String>): String {
        val base = baseUrl.trim().trimEnd('/')
        val q = query.entries.joinToString("&") { (k, v) ->
            "${java.net.URLEncoder.encode(k, "UTF-8")}=${java.net.URLEncoder.encode(v, "UTF-8")}"
        }
        return if (q.isEmpty()) "$base$path" else "$base$path?$q"
    }
}

class StatsApiException(message: String) : Exception(message)