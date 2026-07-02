package codes.awfixer.agentmobile

import codes.awfixer.agentmobile.data.dto.DashboardStatsDto
import codes.awfixer.agentmobile.data.dto.MessageStatsDto
import codes.awfixer.agentmobile.data.dto.RequestDetailsDto
import codes.awfixer.agentmobile.data.dto.SyncResultDto
import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class StatsDtoParsingTest {
    private val json = Json {
        ignoreUnknownKeys = true
        isLenient = true
    }

    @Test
    fun parsesMessageStatsFromStatsPackageShape() {
        val payload = readFixture("message-stats.json")
        val stats = json.decodeFromString(MessageStatsDto.serializer(), payload)

        assertEquals("main", stats.agentType)
        assertEquals("gpt-5.4", stats.model)
        assertEquals(1000, stats.usage.input)
        assertEquals(1700, stats.usage.totalTokens)
        assertEquals(0.0, stats.usage.cost.total, 0.0001)
    }

    @Test
    fun parsesDashboardStatsWithAgentTypeBreakdown() {
        val payload = readFixture("dashboard-stats.json")
        val stats = json.decodeFromString(DashboardStatsDto.serializer(), payload)

        assertEquals(3, stats.overall.totalRequests)
        assertEquals(1, stats.byModel.size)
        assertEquals("claude-sonnet-4.5", stats.byModel.first().model)
        assertEquals(2, stats.byAgentType.size)
        assertEquals("advisor", stats.byAgentType[1].agentType)
        assertEquals(3, stats.timeSeries.first().requests)
    }

    @Test
    fun parsesSyncResultFromServerPayload() {
        val payload = readFixture("sync-result.json")
        val result = json.decodeFromString(SyncResultDto.serializer(), payload)

        assertEquals(3, result.processed)
        assertEquals(2, result.files)
        assertEquals(42, result.totalMessages)
    }

    @Test
    fun parsesRequestDetailsWithMessagesAndOutput() {
        val payload = readFixture("request-details.json")
        val details = json.decodeFromString(RequestDetailsDto.serializer(), payload)

        assertEquals(7, details.id)
        assertEquals("detail-entry", details.entryId)
        assertEquals(0.03, details.usage.cost.total, 0.0001)
        assertEquals(emptyList(), details.messages)
        assertNull(details.output)
    }

    @Test
    fun ignoresUnknownFieldsWithoutFailing() {
        val payload = readFixture("message-stats.json").replace(
            "\"agentType\": \"main\"",
            "\"agentType\": \"main\", \"reasoningTokens\": 42",
        )
        val stats = json.decodeFromString(MessageStatsDto.serializer(), payload)
        assertEquals("main", stats.agentType)
    }

    private fun readFixture(name: String): String {
        val stream = checkNotNull(javaClass.classLoader.getResourceAsStream(name)) {
            "Missing test fixture: $name"
        }
        return stream.bufferedReader().use { it.readText() }
    }
}