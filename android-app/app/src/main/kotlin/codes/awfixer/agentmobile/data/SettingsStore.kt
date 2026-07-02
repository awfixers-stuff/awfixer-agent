package codes.awfixer.agentmobile.data

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

private val Context.dataStore: DataStore<Preferences> by preferencesDataStore(name = "agentmobile_settings")

data class AppSettings(
    val baseUrl: String = DEFAULT_BASE_URL,
    val bearerToken: String = "",
    val timeRange: String = "7d",
)

class SettingsStore(private val context: Context) {
    private val keyBaseUrl = stringPreferencesKey("base_url")
    private val keyBearer = stringPreferencesKey("bearer_token")
    private val keyRange = stringPreferencesKey("time_range")

    val settings: Flow<AppSettings> = context.dataStore.data.map { prefs ->
        AppSettings(
            baseUrl = prefs[keyBaseUrl] ?: DEFAULT_BASE_URL,
            bearerToken = prefs[keyBearer] ?: "",
            timeRange = prefs[keyRange] ?: "7d",
        )
    }

    suspend fun setBaseUrl(url: String) {
        context.dataStore.edit { it[keyBaseUrl] = url.trim().trimEnd('/') }
    }

    suspend fun setBearerToken(token: String) {
        context.dataStore.edit { it[keyBearer] = token.trim() }
    }

    suspend fun setTimeRange(range: String) {
        context.dataStore.edit { it[keyRange] = range }
    }

    companion object {
        /** Emulator loopback to host machine. */
        const val DEFAULT_BASE_URL = "http://10.0.2.2:3847"
    }
}