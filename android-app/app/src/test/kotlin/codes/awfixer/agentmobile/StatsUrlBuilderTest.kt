package codes.awfixer.agentmobile

import codes.awfixer.agentmobile.data.buildStatsUrl
import org.junit.Assert.assertEquals
import org.junit.Test

class StatsUrlBuilderTest {
    @Test
    fun buildUrlTrimsTrailingSlash() {
        val url = buildStatsUrl("http://10.0.2.2:3847/", "/api/stats", mapOf("range" to "7d"))
        assertEquals("http://10.0.2.2:3847/api/stats?range=7d", url)
    }

    @Test
    fun buildUrlEncodesQueryParameters() {
        val url = buildStatsUrl("http://10.0.2.2:3847", "/api/stats/recent", mapOf("limit" to "50"))
        assertEquals("http://10.0.2.2:3847/api/stats/recent?limit=50", url)
    }

    @Test
    fun buildUrlOmitsQueryWhenEmpty() {
        val url = buildStatsUrl("http://10.0.2.2:3847", "/api/sync", emptyMap())
        assertEquals("http://10.0.2.2:3847/api/sync", url)
    }
}