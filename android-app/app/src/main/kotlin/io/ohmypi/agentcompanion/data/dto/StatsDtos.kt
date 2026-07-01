package io.ohmypi.agentcompanion.data.dto

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement

@Serializable
data class AggregatedStatsDto(
    val totalRequests: Int = 0,
    val successfulRequests: Int = 0,
    val failedRequests: Int = 0,
    val errorRate: Double = 0.0,
    val totalInputTokens: Long = 0,
    val totalOutputTokens: Long = 0,
    val totalCacheReadTokens: Long = 0,
    val totalCacheWriteTokens: Long = 0,
    val cacheRate: Double = 0.0,
    val totalCost: Double = 0.0,
    val totalPremiumRequests: Double = 0.0,
    val avgDuration: Double? = null,
    val avgTtft: Double? = null,
    val avgTokensPerSecond: Double? = null,
    val firstTimestamp: Long = 0,
    val lastTimestamp: Long = 0,
)

@Serializable
data class ModelStatsDto(
    val model: String = "",
    val provider: String = "",
    val totalRequests: Int = 0,
    val successfulRequests: Int = 0,
    val failedRequests: Int = 0,
    val errorRate: Double = 0.0,
    val totalInputTokens: Long = 0,
    val totalOutputTokens: Long = 0,
    val totalCacheReadTokens: Long = 0,
    val totalCacheWriteTokens: Long = 0,
    val cacheRate: Double = 0.0,
    val totalCost: Double = 0.0,
    val totalPremiumRequests: Double = 0.0,
    val avgDuration: Double? = null,
    val avgTtft: Double? = null,
    val avgTokensPerSecond: Double? = null,
    val firstTimestamp: Long = 0,
    val lastTimestamp: Long = 0,
)

@Serializable
data class FolderStatsDto(
    val folder: String = "",
    val totalRequests: Int = 0,
    val successfulRequests: Int = 0,
    val failedRequests: Int = 0,
    val errorRate: Double = 0.0,
    val totalInputTokens: Long = 0,
    val totalOutputTokens: Long = 0,
    val totalCacheReadTokens: Long = 0,
    val totalCacheWriteTokens: Long = 0,
    val cacheRate: Double = 0.0,
    val totalCost: Double = 0.0,
    val totalPremiumRequests: Double = 0.0,
    val avgDuration: Double? = null,
    val avgTtft: Double? = null,
    val avgTokensPerSecond: Double? = null,
    val firstTimestamp: Long = 0,
    val lastTimestamp: Long = 0,
)

@Serializable
data class DashboardStatsDto(
    val overall: AggregatedStatsDto = AggregatedStatsDto(),
    val byModel: List<ModelStatsDto> = emptyList(),
    val byFolder: List<FolderStatsDto> = emptyList(),
)

@Serializable
data class UsageCostDto(
    val input: Double = 0.0,
    val output: Double = 0.0,
    val cacheRead: Double = 0.0,
    val cacheWrite: Double = 0.0,
    val total: Double = 0.0,
)

@Serializable
data class UsageDto(
    val input: Int = 0,
    val output: Int = 0,
    val cacheRead: Int = 0,
    val cacheWrite: Int = 0,
    val totalTokens: Int = 0,
    val premiumRequests: Double? = null,
    val cost: UsageCostDto = UsageCostDto(),
)

@Serializable
data class MessageStatsDto(
    val id: Int? = null,
    val sessionFile: String = "",
    val entryId: String = "",
    val folder: String = "",
    val model: String = "",
    val provider: String = "",
    val api: String = "",
    val timestamp: Long = 0,
    val duration: Double? = null,
    val ttft: Double? = null,
    val stopReason: String = "",
    val errorMessage: String? = null,
    val usage: UsageDto = UsageDto(),
)

@Serializable
data class RequestDetailsDto(
    val id: Int? = null,
    val sessionFile: String = "",
    val entryId: String = "",
    val folder: String = "",
    val model: String = "",
    val provider: String = "",
    val api: String = "",
    val timestamp: Long = 0,
    val duration: Double? = null,
    val ttft: Double? = null,
    val stopReason: String = "",
    val errorMessage: String? = null,
    val usage: UsageDto = UsageDto(),
    val messages: List<JsonElement> = emptyList(),
    val output: JsonElement? = null,
)

@Serializable
data class SyncResultDto(
    val totalMessages: Int? = null,
)