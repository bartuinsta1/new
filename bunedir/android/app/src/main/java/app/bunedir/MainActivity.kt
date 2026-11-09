package app.bunedir

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.mutableStateOf
import androidx.lifecycle.lifecycleScope
import app.bunedir.data.Content
import app.bunedir.ui.BuNedirApp
import app.bunedir.widget.WidgetRefresh
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {
    /** Widget'tan ya da bildirimden gelen bunedir://word/9 bağlantısı. */
    private val openWord = mutableStateOf<Int?>(null)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        handle(intent)
        setContent { BuNedirApp(openWord) }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handle(intent)
    }

    override fun onResume() {
        super.onResume()
        WidgetRefresh.schedule(this)
        lifecycleScope.launch { WidgetRefresh.updateNow(this@MainActivity) }
    }

    private fun handle(intent: Intent?) {
        val uri = intent?.data ?: return
        if (uri.scheme == "bunedir" && uri.host == "word") {
            val no = uri.lastPathSegment?.toIntOrNull() ?: return
            if (Content.get(this).words.any { it.no == no }) openWord.value = no
        }
    }
}
