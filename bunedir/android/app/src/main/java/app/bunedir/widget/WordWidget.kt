package app.bunedir.widget

import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.DpSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.Image
import androidx.glance.ImageProvider
import androidx.glance.LocalSize
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import androidx.glance.appwidget.SizeMode
import androidx.glance.appwidget.action.actionStartActivity
import androidx.glance.appwidget.cornerRadius
import androidx.glance.appwidget.provideContent
import androidx.glance.background
import androidx.glance.layout.Alignment
import androidx.glance.layout.Box
import androidx.glance.layout.Column
import androidx.glance.layout.ContentScale
import androidx.glance.layout.Row
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.height
import androidx.glance.layout.padding
import androidx.glance.layout.width
import androidx.glance.text.FontFamily
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextStyle
import androidx.glance.unit.ColorProvider
import app.bunedir.MainActivity
import app.bunedir.data.Content
import app.bunedir.data.Daily

private val Paper = ColorProvider(Color(0xFFF4EEE1))
private val Ink = ColorProvider(Color(0xFF2B2622))
private val InkSoft = ColorProvider(Color(0x992B2622))
private val Accent = ColorProvider(Color(0xFFB07A2A))
private val Review = ColorProvider(Color(0xFFB04A33))

/**
 * Ana ekran widget'ı. İçerik her çizimde o anki saatten hesaplanır; [WidgetRefresh] her 3 saatlik
 * dilimin başında yeniden çizdirir (günün kelimesi, dönen sahne, "hatırla" kartları).
 */
class WordWidget : GlanceAppWidget() {
    companion object {
        val SMALL = DpSize(110.dp, 110.dp)
        val MEDIUM = DpSize(250.dp, 110.dp)
        val LARGE = DpSize(250.dp, 250.dp)
    }

    override val sizeMode = SizeMode.Responsive(setOf(SMALL, MEDIUM, LARGE))

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val content = Content.get(context)
        val entry = Daily.entry(content)
        val bitmap = Content.bitmap(context, entry.image)
        val open = Intent(Intent.ACTION_VIEW, Uri.parse("bunedir://word/${entry.word.no}"), context, MainActivity::class.java)
        provideContent { WidgetBody(entry, bitmap?.let { ImageProvider(it) }, open) }
    }
}

@Composable
private fun WidgetBody(entry: Daily.Entry, background: ImageProvider?, open: Intent) {
    val size = LocalSize.current
    val w = entry.word
    val label = when (entry.daysAgo) {
        0 -> "GÜNÜN KELİMESİ"
        1 -> "HATIRLA · DÜN"
        7 -> "HATIRLA · GEÇEN HAFTA"
        else -> "HATIRLA · ${entry.daysAgo} GÜN ÖNCE"
    }
    val labelColor = if (entry.kind == Daily.Kind.REVIEW) Review else InkSoft

    Box(
        modifier = GlanceModifier.fillMaxSize().cornerRadius(16.dp).background(Color(0xFFD9E3E8))
            .clickable(actionStartActivity(open)),
    ) {
        if (background != null) {
            Image(background, contentDescription = null, contentScale = ContentScale.Crop, modifier = GlanceModifier.fillMaxSize())
        }
        when {
            size.width >= LARGE.width && size.height >= LARGE.height -> Column(
                modifier = GlanceModifier.fillMaxSize().padding(12.dp),
                verticalAlignment = Alignment.Bottom,
            ) {
                Card {
                    Text(label, style = TextStyle(fontSize = 10.sp, fontWeight = FontWeight.Bold, color = labelColor))
                    Text(w.word, maxLines = 1, style = TextStyle(fontSize = 28.sp, fontWeight = FontWeight.Bold, fontFamily = FontFamily.Serif, color = Accent))
                    Text("${w.origin} · ${w.meaning}", maxLines = 3, style = TextStyle(fontSize = 12.sp, color = Ink))
                    Spacer(GlanceModifier.height(4.dp))
                    Text(w.story, maxLines = 4, style = TextStyle(fontSize = 11.sp, color = InkSoft))
                }
                Spacer(GlanceModifier.height(6.dp))
                Card { Text("“${w.oneLiner}”", maxLines = 2, style = TextStyle(fontSize = 11.sp, fontWeight = FontWeight.Medium, color = Ink)) }
            }
            size.width >= MEDIUM.width -> Row(
                modifier = GlanceModifier.fillMaxSize().padding(10.dp),
                horizontalAlignment = Alignment.End,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Spacer(GlanceModifier.defaultWeight())
                Box(GlanceModifier.width((size.width.value * 0.58f).dp)) {
                    Card {
                        Text(label, style = TextStyle(fontSize = 9.sp, fontWeight = FontWeight.Bold, color = labelColor))
                        Text(w.word, maxLines = 1, style = TextStyle(fontSize = 20.sp, fontWeight = FontWeight.Bold, fontFamily = FontFamily.Serif, color = Accent))
                        Text(w.meaning, maxLines = 3, style = TextStyle(fontSize = 11.sp, color = Ink))
                    }
                }
            }
            else -> Column(
                modifier = GlanceModifier.fillMaxSize().padding(8.dp),
                verticalAlignment = Alignment.Bottom,
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Card(centered = true) {
                    Text(label, maxLines = 1, style = TextStyle(fontSize = 8.sp, fontWeight = FontWeight.Bold, color = labelColor))
                    Text(w.word, maxLines = 1, style = TextStyle(fontSize = 17.sp, fontWeight = FontWeight.Bold, fontFamily = FontFamily.Serif, color = Accent))
                    Text(w.origin, maxLines = 1, style = TextStyle(fontSize = 9.sp, color = InkSoft))
                }
            }
        }
    }
}

@Composable
private fun Card(centered: Boolean = false, content: @Composable () -> Unit) {
    Column(
        modifier = GlanceModifier.fillMaxWidth().cornerRadius(3.dp).background(Paper).padding(horizontal = 10.dp, vertical = 8.dp),
        horizontalAlignment = if (centered) Alignment.CenterHorizontally else Alignment.Start,
    ) { content() }
}

class WordWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = WordWidget()

    override fun onEnabled(context: Context) {
        super.onEnabled(context)
        WidgetRefresh.schedule(context)
    }

    override fun onDisabled(context: Context) {
        super.onDisabled(context)
        WidgetRefresh.cancel(context)
    }
}
