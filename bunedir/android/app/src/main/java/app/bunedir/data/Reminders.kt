package app.bunedir.data

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import app.bunedir.MainActivity
import app.bunedir.R
import java.time.LocalDate
import java.time.LocalDateTime

/**
 * İsteğe bağlı günlük bildirim. Widget yenileme işi her dilim başında çalışır; seçilen saat bir dilim
 * başlangıcıdır (06, 09, 12, 15, 18, 21), o gün henüz gönderilmediyse bildirim gönderilir.
 */
object Reminders {
    val HOURS = listOf(6, 9, 12, 15, 18, 21)
    private const val CHANNEL = "daily-word"
    private fun prefs(c: Context) = c.getSharedPreferences("reminders", Context.MODE_PRIVATE)

    fun isEnabled(c: Context) = prefs(c).getBoolean("enabled", false)
    fun hour(c: Context) = prefs(c).getInt("hour", 9)

    fun set(c: Context, enabled: Boolean, hour: Int = hour(c)) {
        prefs(c).edit().putBoolean("enabled", enabled).putInt("hour", hour).apply()
    }

    fun notifyIfDue(c: Context, now: LocalDateTime = LocalDateTime.now()) {
        if (!isEnabled(c) || now.hour < hour(c)) return
        val today = now.toLocalDate().toString()
        if (prefs(c).getString("last", null) == today) return
        if (Build.VERSION.SDK_INT >= 33 &&
            ContextCompat.checkSelfPermission(c, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) return

        val word = Daily.today(Content.get(c), LocalDate.now())
        val nm = c.getSystemService(NotificationManager::class.java)
        nm.createNotificationChannel(NotificationChannel(CHANNEL, "Günün kelimesi", NotificationManager.IMPORTANCE_DEFAULT))
        val intent = Intent(Intent.ACTION_VIEW, Uri.parse("bunedir://word/${word.no}"), c, MainActivity::class.java)
        val pi = PendingIntent.getActivity(c, 0, intent, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        val n = NotificationCompat.Builder(c, CHANNEL)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle("Günün kelimesi: ${word.word}")
            .setContentText(word.oneLiner)
            .setStyle(NotificationCompat.BigTextStyle().bigText("${word.meaning}\n“${word.oneLiner}”"))
            .setContentIntent(pi)
            .setAutoCancel(true)
            .build()
        NotificationManagerCompat.from(c).notify(1, n)
        prefs(c).edit().putString("last", today).apply()
    }
}
