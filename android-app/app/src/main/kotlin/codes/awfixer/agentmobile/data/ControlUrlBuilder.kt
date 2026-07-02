package codes.awfixer.agentmobile.data

const val DEFAULT_CONTROL_PORT = 3848
const val DEFAULT_STATS_PORT = 3847

fun controlBaseUrl(statsBaseUrl: String): String {
    val base = statsBaseUrl.trim().trimEnd('/')
    if (base.contains(":$DEFAULT_STATS_PORT")) {
        return base.replace(":$DEFAULT_STATS_PORT", ":$DEFAULT_CONTROL_PORT")
    }
    val hostPart = base.substringAfter("://", missingDelimiterValue = base)
    return if (hostPart.contains(":")) {
        base.replace(Regex(":\\d+$"), ":$DEFAULT_CONTROL_PORT")
    } else {
        "$base:$DEFAULT_CONTROL_PORT"
    }
}

fun buildControlUrl(baseUrl: String, path: String): String {
    val base = baseUrl.trim().trimEnd('/')
    return "$base$path"
}