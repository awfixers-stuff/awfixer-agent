package codes.awfixer.agentmobile

import codes.awfixer.agentmobile.data.buildControlUrl
import codes.awfixer.agentmobile.data.controlBaseUrl
import org.junit.Assert.assertEquals
import org.junit.Test

class ControlUrlBuilderTest {
    @Test
    fun controlBaseUrlSwapsStatsPort() {
        assertEquals("http://10.0.2.2:3848", controlBaseUrl("http://10.0.2.2:3847"))
    }

    @Test
    fun controlBaseUrlTrimsTrailingSlash() {
        assertEquals("http://10.0.2.2:3848", controlBaseUrl("http://10.0.2.2:3847/"))
    }

    @Test
    fun buildControlUrlJoinsPath() {
        assertEquals(
            "http://10.0.2.2:3848/api/sessions/sess-1/steer",
            buildControlUrl("http://10.0.2.2:3848", "/api/sessions/sess-1/steer"),
        )
    }
}