package app.bunedir.data

import android.content.Context
import org.json.JSONObject

/** content/dictionary.json'daki bir kelime (1000+ kelimelik sözlük; 50 bölüm de içinde). */
data class DictEntry(
    val id: String,
    val word: String,
    val origin: String,
    val meaning: String,
    val triggers: List<String>,
    /** Bölüm kelimesiyse bölüm numarası. */
    val episode: Int?,
    /** Gündelik kelime: sözlükte durur ama klavye bunun için konuşmaz, widget'ta çıkmaz. */
    val common: Boolean,
)

object Lexicon {
    @Volatile private var cached: List<DictEntry>? = null

    fun get(context: Context): List<DictEntry> = cached ?: synchronized(this) {
        cached ?: parse(context.assets.open("dictionary.json").bufferedReader().use { it.readText() }).also { cached = it }
    }

    fun parse(json: String): List<DictEntry> {
        val arr = JSONObject(json).getJSONArray("entries")
        return (0 until arr.length()).map { i ->
            val o = arr.getJSONObject(i)
            val t = o.getJSONArray("triggers")
            DictEntry(
                id = o.getString("id"),
                word = o.getString("word"),
                origin = o.getString("origin"),
                meaning = o.getString("meaning"),
                triggers = (0 until t.length()).map { t.getString(it) },
                episode = if (o.has("episode")) o.getInt("episode") else null,
                common = o.optBoolean("common", false),
            )
        }
    }

    /** Widget'ın "sözlükten" kartında dönen kelimeler: bölüm ve gündelik olmayanlar, dosyadaki sırayla. */
    fun dailyPool(entries: List<DictEntry>) = entries.filter { !it.common && it.episode == null }

    enum class Family(val title: String) {
        ALL("Hepsi"), JAPANESE("Japonca"), ARABIC("Arapça"), PERSIAN("Farsça"), TURKISH("Türkçe"), WORLD("Dünya");

        fun contains(e: DictEntry) = when (this) {
            ALL -> true
            JAPANESE -> e.origin.startsWith("Japonca")
            ARABIC -> e.origin.startsWith("Arapça")
            PERSIAN -> e.origin.startsWith("Farsça")
            TURKISH -> e.origin.startsWith("Türkçe")
            WORLD -> listOf("Japonca", "Arapça", "Farsça", "Türkçe").none { e.origin.startsWith(it) }
        }
    }

    fun search(entries: List<DictEntry>, query: String, family: Family = Family.ALL): List<DictEntry> {
        val q = Muse.fold(query.trim())
        val list = entries.filter(family::contains)
        if (q.isEmpty()) return list.sortedBy { Muse.fold(it.word) }
        return list.filter { Muse.fold(it.word).contains(q) || Muse.fold(it.meaning).contains(q) }
            .sortedWith(compareBy({ !Muse.fold(it.word).startsWith(q) }, { Muse.fold(it.word) }))
    }
}

/**
 * Klavyenin "ilham" motoru. Referans: scripts/lib/muse.mjs; vektörler: content/muse-vectors.json.
 * Tamamen cihazda çalışır; hiçbir metin dışarı gönderilmez.
 */
object Muse {
    const val WINDOW_TOKENS = 12

    enum class Kind { WORD, FEELING }

    data class Suggestion(val kind: Kind, val entry: DictEntry, val token: String)

    class Prepared(val entry: DictEntry, val keys: List<List<String>>, val triggers: List<List<String>>)

    private val FOLD = mapOf(
        "İ" to "i", "I" to "i", "ı" to "i", "â" to "a", "î" to "i", "û" to "u", "ā" to "a", "ē" to "e", "ī" to "i",
        "ō" to "o", "ū" to "u", "é" to "e", "è" to "e", "ê" to "e", "à" to "a", "á" to "a", "ó" to "o", "ú" to "u",
        "í" to "i", "ñ" to "n", "ã" to "a", "õ" to "o",
    )

    /** Kod noktası kod noktası: küçük harf + şapka/uzatma kaldır; ı → i. ç ğ ö ş ü korunur. */
    fun fold(s: String): String {
        val sb = StringBuilder()
        var i = 0
        while (i < s.length) {
            val cp = s.codePointAt(i)
            val ch = String(Character.toChars(cp))
            val m = FOLD[ch]
            if (m != null) sb.append(m) else {
                val lower = String(Character.toChars(Character.toLowerCase(cp)))
                sb.append(FOLD[lower] ?: lower)
            }
            i += Character.charCount(cp)
        }
        return sb.toString()
    }

    private fun isLetterOrDigit(cp: Int) = Character.isLetter(cp) || Character.getType(cp).let {
        it == Character.DECIMAL_DIGIT_NUMBER.toInt() || it == Character.LETTER_NUMBER.toInt() || it == Character.OTHER_NUMBER.toInt()
    }

    fun tokens(s: String): List<String> {
        val out = mutableListOf<String>()
        val cur = StringBuilder()
        val f = fold(s)
        var i = 0
        while (i < f.length) {
            val cp = f.codePointAt(i)
            if (isLetterOrDigit(cp)) cur.appendCodePoint(cp) else if (cur.isNotEmpty()) { out += cur.toString(); cur.clear() }
            i += Character.charCount(cp)
        }
        if (cur.isNotEmpty()) out += cur.toString()
        return out
    }

    fun prepare(entries: List<DictEntry>): List<Prepared> = entries.filter { !it.common }.map { e ->
        val key = tokens(e.word)
        val keys = if (key.size > 1 || (key.size == 1 && key[0].length >= 4)) listOf(key) else emptyList()
        Prepared(e, keys, e.triggers.map(::tokens).filter { it.isNotEmpty() && it.joinToString("").length >= 3 })
    }

    fun suggest(prepared: List<Prepared>, text: String): Suggestion? {
        if (text.isEmpty()) return null
        val lastCp = text.codePointBefore(text.length)
        if (isLetterOrDigit(lastCp)) return null
        if (text.isBlank()) return null
        val parts = text.split('.', '!', '?', '\n').filter { p -> p.any { Character.isLetter(it) } }
        val toks = tokens(parts.lastOrNull() ?: "").takeLast(WINDOW_TOKENS)
        if (toks.isEmpty()) return null

        // 1) Kelimenin kendisi
        var bestEnd = -1
        var bestLen = 0
        var bestEntry: DictEntry? = null
        for (p in prepared) {
            for (key in p.keys) {
                if (key.size > toks.size) continue
                for (end in toks.size downTo key.size) {
                    if (toks.subList(end - key.size, end) == key) {
                        if (bestEntry == null || end > bestEnd || (end == bestEnd && key.size > bestLen)) {
                            bestEnd = end; bestLen = key.size; bestEntry = p.entry
                        }
                        break
                    }
                }
            }
        }
        bestEntry?.let { return Suggestion(Kind.WORD, it, toks.subList(bestEnd - bestLen, bestEnd).joinToString(" ")) }

        // 2) Tetikleyici: en sondaki kelimeden geriye
        for (end in toks.size downTo 1) {
            val cands = prepared.filter { p -> p.triggers.any { matches(toks, end, it) } }
            if (cands.isNotEmpty()) {
                val token = toks[end - 1]
                var sum = 0
                var i = 0
                while (i < token.length) { val cp = token.codePointAt(i); sum += cp; i += Character.charCount(cp) }
                return Suggestion(Kind.FEELING, cands[sum % cands.size].entry, token)
            }
        }
        return null
    }

    private fun matches(toks: List<String>, end: Int, t: List<String>): Boolean {
        val start = end - t.size
        if (start < 0) return false
        for (i in 0 until t.size - 1) if (toks[start + i] != t[i]) return false
        return toks[end - 1].startsWith(t.last())
    }

    /** Klavye boştayken: bölümlerin tek sözleri ve günün kelimesi, dakikaya göre döner. */
    fun idleLine(content: ContentFile, nowMillis: Long = System.currentTimeMillis()): String {
        val minute = (nowMillis / 60_000).toInt()
        if (minute % 4 == 0) {
            val w = Daily.today(content)
            return "Bugünün kelimesi: ${w.word} — ${w.meaning}"
        }
        return "“${content.words[minute % content.words.size].oneLiner}”"
    }
}
