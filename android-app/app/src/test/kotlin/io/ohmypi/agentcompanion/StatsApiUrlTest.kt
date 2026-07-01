package io.ohmypi.agentcompanion

import org.junit.Assert.assertEquals
import org.junit.Test

class StatsApiUrlTest {
    @Test
    fun buildUrlEncodesQuery() {
        val base = "http://10.0.2.2:3847"
        val path = "/api/stats"
        val q = "range=7d"
        val url = "$base$path?$q"
        assertEquals("http://10.0.2.2:3847/api/stats?range=7d", url)
    }
}