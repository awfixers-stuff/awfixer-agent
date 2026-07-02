package codes.awfixer.agentmobile

import codes.awfixer.agentmobile.data.dto.ControlSessionsResponseDto
import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Test

class ControlDtoParsingTest {
    private val json = Json { ignoreUnknownKeys = true }

    @Test
    fun parsesSessionsList() {
        val payload = """
            {
              "sessions": [
                { "id": "sess-1", "label": "feature", "state": "streaming" }
              ]
            }
        """.trimIndent()
        val parsed = json.decodeFromString<ControlSessionsResponseDto>(payload)
        assertEquals(1, parsed.sessions.size)
        assertEquals("sess-1", parsed.sessions[0].id)
        assertEquals("feature", parsed.sessions[0].label)
        assertEquals("streaming", parsed.sessions[0].state)
    }
}