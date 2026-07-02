package codes.awfixer.agentmobile.data

import java.net.URLEncoder

fun buildStatsUrl(baseUrl: String, path: String, query: Map<String, String>): String {
    val base = baseUrl.trim().trimEnd('/')
    if (query.isEmpty()) return "$base$path"
    val q = query.entries.joinToString("&") { (k, v) ->
        "${URLEncoder.encode(k, "UTF-8")}=${URLEncoder.encode(v, "UTF-8")}"
    }
    return "$base$path?$q"
}