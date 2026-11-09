package app.bunedir.ui

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import app.bunedir.data.Account
import app.bunedir.data.Content
import app.bunedir.data.Daily
import app.bunedir.data.Reminders
import app.bunedir.data.TrialCode
import app.bunedir.data.Word
import app.bunedir.widget.WidgetRefresh
import kotlinx.coroutines.launch

val Paper = Color(0xFFF4EEE1)
val Ink = Color(0xFF2B2622)
val Accent = Color(0xFFB07A2A)
val ReviewRed = Color(0xFFB04A33)

private val colors = lightColorScheme(primary = Accent, onPrimary = Color.White, background = Color(0xFFFAF7F0), surface = Color(0xFFFAF7F0), onSurface = Ink, onBackground = Ink)

private enum class Tab(val title: String) { TODAY("Bugün"), WORDS("Kelimeler"), QUIZ("Hatırla"), GIFT("2 Ay Hediye") }

@Composable
fun BuNedirApp(openWord: MutableState<Int?>) {
    val context = LocalContext.current
    val content = remember { Content.get(context) }
    var tab by rememberSaveable { mutableStateOf(Tab.TODAY) }
    var detail by remember { mutableStateOf<Word?>(null) }
    var settings by remember { mutableStateOf(false) }

    LaunchedEffect(openWord.value) {
        openWord.value?.let { no ->
            tab = Tab.TODAY
            detail = content.words.first { it.no == no }.takeIf { it != Daily.today(content) }
            openWord.value = null
        }
    }

    MaterialTheme(colorScheme = colors) {
        Scaffold(
            bottomBar = {
                NavigationBar(containerColor = Paper) {
                    Tab.entries.forEach { t ->
                        NavigationBarItem(
                            selected = tab == t,
                            onClick = { tab = t; detail = null },
                            icon = {
                                Icon(when (t) {
                                    Tab.TODAY -> Icons.Filled.Star
                                    Tab.WORDS -> Icons.Filled.List
                                    Tab.QUIZ -> Icons.Filled.Refresh
                                    Tab.GIFT -> Icons.Filled.Favorite
                                }, contentDescription = null)
                            },
                            label = { Text(t.title) },
                        )
                    }
                }
            },
        ) { pad ->
            Box(Modifier.padding(pad).fillMaxSize()) {
                val shown = detail
                when {
                    shown != null -> WordScreen(shown, null, onBack = { detail = null })
                    tab == Tab.TODAY -> WordScreen(Daily.today(content), "GÜNÜN KELİMESİ", onSettings = { settings = true })
                    tab == Tab.WORDS -> ArchiveScreen(content.words, Daily.today(content)) { detail = it }
                    tab == Tab.QUIZ -> QuizScreen()
                    tab == Tab.GIFT -> GiftScreen()
                }
            }
        }
        if (settings) SettingsDialog { settings = false }
    }
}

@Composable
fun PaperCard(modifier: Modifier = Modifier, tilt: Float = 0f, content: @Composable ColumnScope.() -> Unit) {
    Column(
        modifier.rotate(tilt).shadow(2.dp).background(Paper).padding(14.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        content = content,
    )
}

@Composable
fun SceneImage(path: String, modifier: Modifier = Modifier, maxPx: Int = 1080) {
    val context = LocalContext.current
    val bmp = remember(path) { Content.bitmap(context, path, maxPx)?.asImageBitmap() }
    if (bmp != null) Image(bmp, null, modifier.clipToBounds(), contentScale = ContentScale.Crop)
    else Box(modifier.background(Color(0xFFD9E3E8)))
}

@Composable
private fun WordScreen(word: Word, label: String?, onBack: (() -> Unit)? = null, onSettings: (() -> Unit)? = null) {
    val context = LocalContext.current
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState())) {
        Box(contentAlignment = Alignment.BottomCenter) {
            val pager = rememberPagerState { word.images.size }
            HorizontalPager(pager, Modifier.fillMaxWidth().height(340.dp)) { i ->
                SceneImage(word.images[i], Modifier.fillMaxSize())
            }
            Row(Modifier.align(Alignment.TopStart).fillMaxWidth().statusBarsPadding().padding(8.dp)) {
                onBack?.let { IconButton(it) { Icon(Icons.Filled.ArrowBack, "Geri", tint = Ink) } }
                Spacer(Modifier.weight(1f))
                onSettings?.let { IconButton(it) { Icon(Icons.Filled.Settings, "Ayarlar", tint = Ink) } }
            }
            PaperCard(Modifier.offset(y = 28.dp), tilt = -1f) {
                label?.let { Text(it, fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Ink.copy(alpha = 0.55f)) }
                Text(word.word, fontSize = 36.sp, fontFamily = FontFamily.Serif, fontWeight = FontWeight.Bold, color = Accent)
                Text("buna denir.", fontSize = 16.sp, fontFamily = FontFamily.Serif, fontWeight = FontWeight.Bold, color = Ink)
            }
        }
        Column(Modifier.padding(start = 20.dp, end = 20.dp, top = 52.dp, bottom = 24.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            SectionTitle("ANLAMI")
            Text(word.origin, fontWeight = FontWeight.Bold, color = Accent)
            Text(word.meaning, fontSize = 17.sp, color = Ink)
            SectionTitle("HİKÂYESİ")
            Text(word.story, fontSize = 16.sp, color = Ink, lineHeight = 23.sp)
            PaperCard(Modifier.fillMaxWidth(), tilt = 0.8f) {
                Text("“${word.oneLiner}”", fontWeight = FontWeight.SemiBold, textAlign = TextAlign.Center, color = Ink)
            }
            Button(
                onClick = { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(Content.instagramUrl(context, word)))) },
                modifier = Modifier.fillMaxWidth(),
            ) { Text(if (word.reel == null) "Hikâyeleri Instagram'da izle" else "Bu hikâyeyi Instagram'da izle") }
            OutlinedButton(
                onClick = {
                    val text = "${word.word} (${word.origin}): ${word.meaning}\n“${word.oneLiner}”\n${Content.get(context).instagram}"
                    context.startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, text), null))
                },
                modifier = Modifier.fillMaxWidth(),
            ) { Text("Paylaş") }
        }
    }
}

@Composable
private fun SectionTitle(t: String) = Text(t, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Ink.copy(alpha = 0.5f))

@Composable
private fun ArchiveScreen(words: List<Word>, today: Word, open: (Word) -> Unit) {
    LazyVerticalGrid(GridCells.Adaptive(104.dp), contentPadding = PaddingValues(16.dp), horizontalArrangement = Arrangement.spacedBy(10.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        items(words, key = { it.no }) { w ->
            Column(Modifier.clickable { open(w) }) {
                Box {
                    SceneImage(w.cover, Modifier.fillMaxWidth().height(170.dp), maxPx = 400)
                    if (w == today) Text("BUGÜN", Modifier.padding(4.dp).background(Accent).padding(4.dp), color = Color.White, fontSize = 9.sp, fontWeight = FontWeight.Bold)
                }
                Text("%02d · %s".format(w.no, w.word), fontSize = 12.sp, fontWeight = FontWeight.SemiBold, maxLines = 1, color = Ink)
            }
        }
    }
}

@Composable
private fun QuizScreen() {
    val context = LocalContext.current
    val content = remember { Content.get(context) }
    val prefs = remember { context.getSharedPreferences("quiz", 0) }
    var streak by remember { mutableIntStateOf(prefs.getInt("streak", 0)) }
    var best by remember { mutableIntStateOf(prefs.getInt("best", 0)) }
    fun newQuestion(): Pair<Word, List<Word>> {
        val pool = Daily.recentWords(content, 14).ifEmpty { content.words }
        val answer = pool.random()
        return answer to (listOf(answer) + content.words.filter { it != answer }.shuffled().take(2)).shuffled()
    }
    var q by remember { mutableStateOf(newQuestion()) }
    var picked by remember { mutableStateOf<Word?>(null) }

    Column(Modifier.fillMaxSize().padding(20.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        Row { Text("🔥 $streak seri", fontWeight = FontWeight.SemiBold); Spacer(Modifier.weight(1f)); Text("En iyi: $best") }
        PaperCard(Modifier.fillMaxWidth(), tilt = -0.8f) {
            Text("HANGİ KELİME?", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Ink.copy(alpha = 0.5f))
            Text(q.first.meaning, fontSize = 18.sp, textAlign = TextAlign.Center, color = Ink)
        }
        q.second.forEach { w ->
            val color = when {
                picked == null -> Ink
                w == q.first -> Color(0xFF3C8A3C)
                w == picked -> ReviewRed
                else -> Ink.copy(alpha = 0.4f)
            }
            OutlinedButton(
                onClick = {
                    picked = w
                    if (w == q.first) { streak++; best = maxOf(best, streak) } else streak = 0
                    prefs.edit().putInt("streak", streak).putInt("best", best).apply()
                },
                enabled = picked == null,
                modifier = Modifier.fillMaxWidth(),
            ) { Text(w.word, fontSize = 20.sp, fontFamily = FontFamily.Serif, fontWeight = FontWeight.Bold, color = color) }
        }
        picked?.let {
            Text(if (it == q.first) "Doğru! ${q.first.oneLiner}" else "Doğrusu: ${q.first.word}", fontWeight = FontWeight.SemiBold, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth())
            Button({ q = newQuestion(); picked = null }, Modifier.fillMaxWidth()) { Text("Sıradaki") }
        }
    }
}

@Composable
private fun GiftScreen() {
    val context = LocalContext.current
    val account = remember { Account(context) }
    val scope = rememberCoroutineScope()
    val clipboard = LocalClipboardManager.current
    var trial by remember { mutableStateOf(account.trial) }
    var email by remember { mutableStateOf(account.email ?: "") }
    var otp by remember { mutableStateOf("") }
    var sent by remember { mutableStateOf(false) }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var confirmDelete by remember { mutableStateOf(false) }

    fun run(op: suspend () -> Unit) {
        error = null; busy = true
        scope.launch {
            try { op() } catch (e: Exception) { error = e.message } finally { busy = false }
        }
    }
    LaunchedEffect(Unit) { if (trial != null) runCatching { trial = account.refreshTrial() } }

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(20.dp), verticalArrangement = Arrangement.spacedBy(14.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        PaperCard(Modifier.fillMaxWidth(), tilt = -1.2f) {
            Text("2 ay ücretsiz", fontSize = 30.sp, fontFamily = FontFamily.Serif, fontWeight = FontWeight.Bold, color = Accent)
            Text("Ücretsiz kaydol, yakında çıkacak yeni uygulamamızı ${Account.TRIAL_DAYS / 30} ay boyunca ücretsiz dene.", textAlign = TextAlign.Center, color = Ink)
        }
        val t: TrialCode? = trial
        when {
            t != null -> {
                Text("Hediye kodun", fontWeight = FontWeight.Bold, color = Ink.copy(alpha = 0.6f))
                Text(t.code, fontSize = 28.sp, fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold, color = Ink)
                Text(
                    if (t.redeemed) "Bu kod kullanıldı. İyi eğlenceler!"
                    else "Yeni uygulamamız çıkınca bu kodu orada gir, ${t.trialDays} gün ücretsiz kullan. Kod e-posta adresine bağlı, kaybolmaz.",
                    textAlign = TextAlign.Center,
                )
                OutlinedButton({ clipboard.setText(AnnotatedString(t.code)) }) { Text("Kopyala") }
                TextButton({ confirmDelete = true }) { Text("Hesabımı sil", color = ReviewRed) }
            }
            !account.enabled -> Text("Kayıt çok yakında açılıyor.", color = Ink.copy(alpha = 0.6f))
            !sent -> {
                OutlinedTextField(email, { email = it }, label = { Text("E-posta adresin") }, singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email), modifier = Modifier.fillMaxWidth())
                Button({ run { account.sendCode(email); sent = true } }, enabled = !busy, modifier = Modifier.fillMaxWidth()) { Text("Kodu gönder") }
                Text("Parola yok. E-postana 6 haneli bir kod göndereceğiz. Adresini yalnızca hediyeni tanımlamak için kullanırız; reklam göndermeyiz.",
                    fontSize = 12.sp, textAlign = TextAlign.Center, color = Ink.copy(alpha = 0.6f))
            }
            else -> {
                Text("${account.email} adresine gelen kodu yaz")
                OutlinedTextField(otp, { otp = it.filter(Char::isDigit).take(6) }, label = { Text("6 haneli kod") }, singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword), modifier = Modifier.fillMaxWidth())
                Button({ run { trial = account.verify(otp) } }, enabled = !busy && otp.length == 6, modifier = Modifier.fillMaxWidth()) { Text("Onayla") }
                TextButton({ sent = false; otp = "" }) { Text("E-postayı değiştir") }
            }
        }
        if (busy) CircularProgressIndicator()
        error?.let { Text(it, color = ReviewRed, textAlign = TextAlign.Center) }
    }

    if (confirmDelete) AlertDialog(
        onDismissRequest = { confirmDelete = false },
        title = { Text("Hesabın ve hediye kodun kalıcı olarak silinsin mi?") },
        confirmButton = { TextButton({ confirmDelete = false; run { account.deleteAccount(); trial = null; sent = false } }) { Text("Hesabımı sil", color = ReviewRed) } },
        dismissButton = { TextButton({ confirmDelete = false }) { Text("Vazgeç") } },
    )
}

@Composable
private fun SettingsDialog(onDismiss: () -> Unit) {
    val context = LocalContext.current
    var enabled by remember { mutableStateOf(Reminders.isEnabled(context)) }
    var hour by remember { mutableIntStateOf(Reminders.hour(context)) }
    val permission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        enabled = granted
        Reminders.set(context, granted, hour)
        if (granted) WidgetRefresh.schedule(context)
    }
    fun toggle(on: Boolean) {
        if (on && Build.VERSION.SDK_INT >= 33 &&
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) {
            permission.launch(Manifest.permission.POST_NOTIFICATIONS)
            return
        }
        enabled = on
        Reminders.set(context, on, hour)
        if (on) WidgetRefresh.schedule(context)
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        confirmButton = { TextButton(onDismiss) { Text("Tamam") } },
        title = { Text("Ayarlar") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("Günlük hatırlatma", Modifier.weight(1f))
                    Switch(enabled, ::toggle)
                }
                if (enabled) Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    Reminders.HOURS.forEach { h ->
                        FilterChip(hour == h, { hour = h; Reminders.set(context, true, h) }, label = { Text("%02d".format(h)) })
                    }
                }
                Text("Widget eklemek için: ana ekranda boş bir yere basılı tut → Widget'lar → \"Bu Nedir?\". Widget gün boyu sahneyi değiştirir; öğlen, akşam ve gece önceki kelimeleri hatırlatır.", fontSize = 13.sp)
                TextButton({ context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(Content.get(context).instagram))) }) {
                    Text("Instagram: @bu.nedir1")
                }
            }
        },
    )
}
