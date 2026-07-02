package codes.awfixer.agentmobile.ui

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import codes.awfixer.agentmobile.data.AppSettings
import codes.awfixer.agentmobile.data.ControlApi
import codes.awfixer.agentmobile.data.HttpControlRepository
import codes.awfixer.agentmobile.data.SettingsStore
import codes.awfixer.agentmobile.data.StatsApi
import codes.awfixer.agentmobile.data.StatsApiException
import codes.awfixer.agentmobile.data.dto.DashboardStatsDto
import codes.awfixer.agentmobile.data.dto.MessageStatsDto
import codes.awfixer.agentmobile.domain.ControlState
import codes.awfixer.agentmobile.domain.StatsRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

data class UiLoadState<T>(
    val data: T? = null,
    val loading: Boolean = false,
    val error: String? = null,
)

class AppViewModel(application: Application) : AndroidViewModel(application) {
    private val settingsStore = SettingsStore(application)
    private val statsRepository = StatsRepository(StatsApi())
    private val controlRepository = HttpControlRepository(ControlApi())

    val settings: StateFlow<AppSettings> = settingsStore.settings.stateIn(
        viewModelScope,
        SharingStarted.WhileSubscribed(5_000),
        AppSettings(),
    )

    private val _dashboard = MutableStateFlow(UiLoadState<DashboardStatsDto>())
    val dashboard: StateFlow<UiLoadState<DashboardStatsDto>> = _dashboard.asStateFlow()

    private val _recent = MutableStateFlow(UiLoadState<List<MessageStatsDto>>())
    val recent: StateFlow<UiLoadState<List<MessageStatsDto>>> = _recent.asStateFlow()

    private val _errors = MutableStateFlow(UiLoadState<List<MessageStatsDto>>())
    val errors: StateFlow<UiLoadState<List<MessageStatsDto>>> = _errors.asStateFlow()

    private val _control = MutableStateFlow<ControlState>(ControlState.Offline)
    val control: StateFlow<ControlState> = _control.asStateFlow()

    private val _statusMessage = MutableStateFlow<String?>(null)
    val statusMessage: StateFlow<String?> = _statusMessage.asStateFlow()

    init {
        viewModelScope.launch {
            settings.collect { refreshAll(it) }
        }
    }

    fun refreshAll(current: AppSettings = settings.value) {
        loadDashboard(current)
        loadRecent(current)
        loadErrors(current)
        viewModelScope.launch { _control.value = controlRepository.refresh(current) }
    }

    fun loadDashboard(settings: AppSettings) {
        viewModelScope.launch {
            _dashboard.value = _dashboard.value.copy(loading = true, error = null)
            try {
                val data = statsRepository.loadDashboard(settings)
                _dashboard.value = UiLoadState(data = data, loading = false)
            } catch (e: Exception) {
                _dashboard.value = UiLoadState(loading = false, error = e.userMessage())
            }
        }
    }

    fun loadRecent(settings: AppSettings) {
        viewModelScope.launch {
            _recent.value = _recent.value.copy(loading = true, error = null)
            try {
                val data = statsRepository.loadRecent(settings)
                _recent.value = UiLoadState(data = data, loading = false)
            } catch (e: Exception) {
                _recent.value = UiLoadState(loading = false, error = e.userMessage())
            }
        }
    }

    fun loadErrors(settings: AppSettings) {
        viewModelScope.launch {
            _errors.value = _errors.value.copy(loading = true, error = null)
            try {
                val data = statsRepository.loadErrors(settings)
                _errors.value = UiLoadState(data = data, loading = false)
            } catch (e: Exception) {
                _errors.value = UiLoadState(loading = false, error = e.userMessage())
            }
        }
    }

    fun sync(settings: AppSettings) {
        viewModelScope.launch {
            _statusMessage.value = "Syncing sessions…"
            try {
                val result = statsRepository.sync(settings)
                _statusMessage.value = "Sync complete (${result.totalMessages ?: "?"} messages indexed)"
                refreshAll(settings)
            } catch (e: Exception) {
                _statusMessage.value = "Sync failed: ${e.userMessage()}"
            }
        }
    }

    fun saveBaseUrl(url: String) {
        viewModelScope.launch { settingsStore.setBaseUrl(url) }
    }

    fun saveBearer(token: String) {
        viewModelScope.launch { settingsStore.setBearerToken(token) }
    }

    fun saveTimeRange(range: String) {
        viewModelScope.launch { settingsStore.setTimeRange(range) }
    }

    fun clearStatus() {
        _statusMessage.value = null
    }

    private fun Exception.userMessage(): String = when (this) {
        is StatsApiException -> message ?: "API error"
        else -> message ?: "Unknown error"
    }
}