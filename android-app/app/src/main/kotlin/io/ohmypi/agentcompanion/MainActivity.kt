package io.ohmypi.agentcompanion

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import io.ohmypi.agentcompanion.ui.AgentCompanionApp
import io.ohmypi.agentcompanion.ui.theme.AgentCompanionTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            AgentCompanionTheme {
                AgentCompanionApp()
            }
        }
    }
}