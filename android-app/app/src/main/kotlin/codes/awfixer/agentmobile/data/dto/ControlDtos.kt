package codes.awfixer.agentmobile.data.dto

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class ControlSessionsResponseDto(
    val sessions: List<ControlSessionSummaryDto> = emptyList(),
)

@Serializable
data class ControlSessionSummaryDto(
    val id: String,
    val label: String,
    val state: String,
)

@Serializable
data class ControlOkResponseDto(
    val ok: Boolean = true,
)

@Serializable
data class ControlSteerRequestDto(
    val message: String,
)