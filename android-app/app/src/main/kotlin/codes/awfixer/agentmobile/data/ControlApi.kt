package codes.awfixer.agentmobile.data

import codes.awfixer.agentmobile.data.dto.ControlOkResponseDto
import codes.awfixer.agentmobile.data.dto.ControlSessionsResponseDto
import codes.awfixer.agentmobile.data.dto.ControlSteerRequestDto
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.engine.android.Android
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.http.ContentType
import io.ktor.http.contentType
import io.ktor.http.isSuccess
import io.ktor.serialization.kotlinx.json.json
import kotlinx.serialization.json.Json

class ControlApi {
    private val json = Json {
        ignoreUnknownKeys = true
        isLenient = true
    }

    private val client = HttpClient(Android) {
        install(ContentNegotiation) {
            json(json)
        }
    }

    suspend fun fetchSessions(baseUrl: String, bearer: String?): ControlSessionsResponseDto =
        get(baseUrl, "/api/sessions", bearer)

    suspend fun steer(baseUrl: String, sessionId: String, message: String, bearer: String?) {
        val url = buildControlUrl(baseUrl, "/api/sessions/$sessionId/steer")
        val response = client.post(url) {
            if (!bearer.isNullOrBlank()) header("Authorization", "Bearer $bearer")
            contentType(ContentType.Application.Json)
            setBody(ControlSteerRequestDto(message))
        }
        if (!response.status.isSuccess()) {
            throw ControlApiException("Steer failed: HTTP ${response.status.value}")
        }
        response.body<ControlOkResponseDto>()
    }

    suspend fun abort(baseUrl: String, sessionId: String, bearer: String?) {
        val url = buildControlUrl(baseUrl, "/api/sessions/$sessionId/abort")
        val response = client.post(url) {
            if (!bearer.isNullOrBlank()) header("Authorization", "Bearer $bearer")
        }
        if (!response.status.isSuccess()) {
            throw ControlApiException("Abort failed: HTTP ${response.status.value}")
        }
        response.body<ControlOkResponseDto>()
    }

    private suspend inline fun <reified T> get(baseUrl: String, path: String, bearer: String?): T {
        val url = buildControlUrl(baseUrl, path)
        val response = client.get(url) {
            if (!bearer.isNullOrBlank()) header("Authorization", "Bearer $bearer")
        }
        if (!response.status.isSuccess()) {
            throw ControlApiException("GET $path failed: HTTP ${response.status.value}")
        }
        return response.body()
    }
}

class ControlApiException(message: String) : Exception(message)