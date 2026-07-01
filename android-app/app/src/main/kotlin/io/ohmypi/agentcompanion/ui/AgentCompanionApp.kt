package io.ohmypi.agentcompanion.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Dashboard
import androidx.compose.material.icons.filled.Error
import androidx.compose.material.icons.filled.Memory
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.SmartToy
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import io.ohmypi.agentcompanion.data.dto.AggregatedStatsDto
import io.ohmypi.agentcompanion.data.dto.FolderStatsDto
import io.ohmypi.agentcompanion.data.dto.MessageStatsDto
import io.ohmypi.agentcompanion.data.dto.ModelStatsDto
import io.ohmypi.agentcompanion.domain.ControlState
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

private enum class Tab(val label: String) {
    Overview("Overview"),
    Models("Models"),
    Activity("Activity"),
    Manage("Manage"),
    Settings("Settings"),
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AgentCompanionApp(viewModel: AppViewModel = viewModel()) {
    var tab by remember { mutableStateOf(Tab.Overview) }
    val settings by viewModel.settings.collectAsState()
    val dashboard by viewModel.dashboard.collectAsState()
    val recent by viewModel.recent.collectAsState()
    val errors by viewModel.errors.collectAsState()
    val control by viewModel.control.collectAsState()
    val status by viewModel.statusMessage.collectAsState()
    val snackbar = remember { SnackbarHostState() }

    LaunchedEffect(status) {
        status?.let {
            snackbar.showSnackbar(it)
            viewModel.clearStatus()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("OMP Companion") },
                actions = {
                    TextButton(onClick = { viewModel.sync(settings) }) {
                        Text("Sync")
                    }
                },
            )
        },
        bottomBar = {
            NavigationBar {
                Tab.entries.forEach { item ->
                    NavigationBarItem(
                        selected = tab == item,
                        onClick = { tab = item },
                        icon = {
                            Icon(
                                when (item) {
                                    Tab.Overview -> Icons.Default.Dashboard
                                    Tab.Models -> Icons.Default.Memory
                                    Tab.Activity -> Icons.Default.Error
                                    Tab.Manage -> Icons.Default.SmartToy
                                    Tab.Settings -> Icons.Default.Settings
                                },
                                contentDescription = item.label,
                            )
                        },
                        label = { Text(item.label) },
                    )
                }
            }
        },
        snackbarHost = { SnackbarHost(snackbar) },
    ) { padding ->
        when (tab) {
            Tab.Overview -> OverviewScreen(padding, dashboard, settings.baseUrl)
            Tab.Models -> ModelsScreen(padding, dashboard)
            Tab.Activity -> ActivityScreen(padding, recent, errors)
            Tab.Manage -> ManageScreen(padding, control)
            Tab.Settings -> SettingsScreen(
                padding = padding,
                baseUrl = settings.baseUrl,
                bearer = settings.bearerToken,
                range = settings.timeRange,
                onSaveUrl = viewModel::saveBaseUrl,
                onSaveBearer = viewModel::saveBearer,
                onSaveRange = viewModel::saveTimeRange,
            )
        }
    }
}

@Composable
private fun OverviewScreen(
    padding: PaddingValues,
    state: UiLoadState<io.ohmypi.agentcompanion.data.dto.DashboardStatsDto>,
    baseUrl: String,
) {
    ScreenFrame(padding, state.loading, state.error) {
        val overall = state.data?.overall
        if (overall != null) {
            StatsCard("Overall", overall)
        }
        Text(
            "Server: $baseUrl",
            style = MaterialTheme.typography.bodySmall,
            modifier = Modifier.padding(top = 8.dp),
        )
        state.data?.byFolder?.take(5)?.forEach { folder ->
            FolderRow(folder)
        }
    }
}

@Composable
private fun ModelsScreen(
    padding: PaddingValues,
    state: UiLoadState<io.ohmypi.agentcompanion.data.dto.DashboardStatsDto>,
) {
    ScreenFrame(padding, state.loading, state.error) {
        val models = state.data?.byModel.orEmpty()
        if (models.isEmpty()) {
            Text("No model stats yet. Run Sync on the stats host.")
        } else {
            models.forEach { ModelRow(it) }
        }
    }
}

@Composable
private fun ActivityScreen(
    padding: PaddingValues,
    recent: UiLoadState<List<MessageStatsDto>>,
    errors: UiLoadState<List<MessageStatsDto>>,
) {
    val loading = recent.loading || errors.loading
    val error = recent.error ?: errors.error
    ScreenFrame(padding, loading, error) {
        Text("Recent", style = MaterialTheme.typography.titleMedium)
        recent.data.orEmpty().take(20).forEach { MessageRow(it) }
        Text("Errors", style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(top = 16.dp))
        errors.data.orEmpty().take(20).forEach { MessageRow(it) }
    }
}

@Composable
private fun ManageScreen(padding: PaddingValues, control: ControlState) {
    Column(Modifier.padding(padding).padding(16.dp).fillMaxSize()) {
        Text("Agent control", style = MaterialTheme.typography.titleLarge)
        when (control) {
            ControlState.Offline -> {
                Text(
                    "No control server detected. Live interject/abort requires a future OMP control HTTP API " +
                        "(today only JSON-RPC in the desktop CLI).",
                    modifier = Modifier.padding(top = 12.dp),
                )
            }
            is ControlState.Error -> Text(control.message, color = MaterialTheme.colorScheme.error)
            is ControlState.Online -> {
                control.sessions.forEach { session ->
                    Text("${session.label} — ${session.state}")
                }
            }
        }
    }
}

@Composable
private fun SettingsScreen(
    padding: PaddingValues,
    baseUrl: String,
    bearer: String,
    range: String,
    onSaveUrl: (String) -> Unit,
    onSaveBearer: (String) -> Unit,
    onSaveRange: (String) -> Unit,
) {
    var url by remember(baseUrl) { mutableStateOf(baseUrl) }
    var token by remember(bearer) { mutableStateOf(bearer) }
    var timeRange by remember(range) { mutableStateOf(range) }
    Column(Modifier.padding(padding).padding(16.dp).fillMaxSize(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        OutlinedTextField(url, { url = it }, label = { Text("Stats base URL") }, modifier = Modifier.fillMaxWidth())
        OutlinedTextField(token, { token = it }, label = { Text("Bearer token (optional)") }, modifier = Modifier.fillMaxWidth())
        OutlinedTextField(timeRange, { timeRange = it }, label = { Text("Range (1h, 24h, 7d, 30d, 90d, all)") }, modifier = Modifier.fillMaxWidth())
        TextButton(onClick = {
            onSaveUrl(url)
            onSaveBearer(token)
            onSaveRange(timeRange)
        }) {
            Text("Save")
        }
        Text(
            "Emulator default 10.0.2.2:3847 reaches the host. On device use your machine LAN IP.",
            style = MaterialTheme.typography.bodySmall,
        )
    }
}

@Composable
private fun ScreenFrame(
    padding: PaddingValues,
    loading: Boolean,
    error: String?,
    content: @Composable () -> Unit,
) {
    Column(Modifier.padding(padding).padding(16.dp).fillMaxSize()) {
        if (loading) CircularProgressIndicator()
        error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
        LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            item { content() }
        }
    }
}

@Composable
private fun StatsCard(title: String, stats: AggregatedStatsDto) {
    Card(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(12.dp)) {
            Text(title, style = MaterialTheme.typography.titleMedium)
            Text("Requests: ${stats.totalRequests} (${stats.failedRequests} failed, ${pct(stats.errorRate)} err)")
            Text("Tokens in/out: ${stats.totalInputTokens} / ${stats.totalOutputTokens}")
            Text("Cost: $${"%.4f".format(stats.totalCost)}")
            Text("Avg TTFT: ${stats.avgTtft?.let { "${it.toInt()} ms" } ?: "—"}")
        }
    }
}

@Composable
private fun ModelRow(m: ModelStatsDto) {
    Card(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(12.dp)) {
            Text("${m.provider} / ${m.model}", style = MaterialTheme.typography.titleSmall)
            Text("${m.totalRequests} req · $${"%.4f".format(m.totalCost)}")
        }
    }
}

@Composable
private fun FolderRow(f: FolderStatsDto) {
    Text(
        "${shortFolder(f.folder)} — ${f.totalRequests} req · $${"%.2f".format(f.totalCost)}",
        fontFamily = FontFamily.Monospace,
        style = MaterialTheme.typography.bodySmall,
    )
}

@Composable
private fun MessageRow(m: MessageStatsDto) {
    Card(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(10.dp)) {
            Text("${m.model} · ${m.stopReason}", style = MaterialTheme.typography.labelLarge)
            Text(formatTime(m.timestamp), style = MaterialTheme.typography.bodySmall)
            m.errorMessage?.let { Text(it, color = MaterialTheme.colorScheme.error, maxLines = 2) }
            Text("$${"%.4f".format(m.usage.cost.total)} · ${m.folder}", style = MaterialTheme.typography.bodySmall)
        }
    }
}

private fun pct(rate: Double): String = "${(rate * 100).toInt()}%"

private fun shortFolder(path: String): String {
    if (path.length <= 48) return path
    return "…" + path.takeLast(45)
}

private fun formatTime(ts: Long): String {
    if (ts <= 0) return ""
    return SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.US).format(Date(ts))
}