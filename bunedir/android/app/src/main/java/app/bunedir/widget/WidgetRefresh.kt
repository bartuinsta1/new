package app.bunedir.widget

import android.content.Context
import androidx.glance.appwidget.GlanceAppWidgetManager
import androidx.glance.appwidget.updateAll
import androidx.work.CoroutineWorker
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import app.bunedir.data.Daily
import app.bunedir.data.Reminders
import java.time.Duration
import java.time.LocalDateTime
import java.util.concurrent.TimeUnit

/**
 * Arka plan: bir sonraki 3 saatlik dilimin başına tek seferlik iş kurar; iş widget'ları yeniden çizer,
 * gerekiyorsa günlük bildirimi gönderir ve kendini bir sonraki dilime yeniden kurar.
 * Cihaz yeniden başlasa da WorkManager işi korur. Doze nedeniyle birkaç dakika gecikebilir.
 */
object WidgetRefresh {
    private const val WORK = "bunedir-widget-refresh"

    fun schedule(context: Context, now: LocalDateTime = LocalDateTime.now()) {
        val delay = Duration.between(now, Daily.nextSlotStart(now)).toMillis().coerceAtLeast(60_000) + 5_000
        val req = OneTimeWorkRequestBuilder<RefreshWorker>().setInitialDelay(delay, TimeUnit.MILLISECONDS).build()
        WorkManager.getInstance(context).enqueueUniqueWork(WORK, ExistingWorkPolicy.REPLACE, req)
    }

    fun cancel(context: Context) = WorkManager.getInstance(context).cancelUniqueWork(WORK)

    suspend fun updateNow(context: Context) = WordWidget().updateAll(context)

    suspend fun hasWidgets(context: Context) =
        GlanceAppWidgetManager(context).getGlanceIds(WordWidget::class.java).isNotEmpty()
}

class RefreshWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result {
        WidgetRefresh.updateNow(applicationContext)
        Reminders.notifyIfDue(applicationContext)
        if (WidgetRefresh.hasWidgets(applicationContext) || Reminders.isEnabled(applicationContext)) {
            WidgetRefresh.schedule(applicationContext)
        }
        return Result.success()
    }
}
