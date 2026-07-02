package codes.awfixer.agentmobile

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import codes.awfixer.agentmobile.ui.AgentCompanionApp
import codes.awfixer.agentmobile.ui.theme.AgentCompanionTheme

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