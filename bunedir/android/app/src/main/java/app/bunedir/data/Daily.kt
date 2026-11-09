package app.bunedir.data

import java.time.LocalDate
import java.time.LocalDateTime
import java.time.temporal.ChronoUnit

/**
 * "Günün kelimesi" kuralı. Referansı: scripts/lib/daily.mjs; ortak vektörler: content/test-vectors.json.
 * Gün 3 saatlik 8 dilime ayrılır; 12:00, 18:00 ve 21:00 dilimleri 1, 3 ve 7 gün önceki kelimeyi hatırlatır.
 */
object Daily {
    const val SLOT_HOURS = 3
    const val SLOTS_PER_DAY = 24 / SLOT_HOURS
    val REVIEW_SLOTS = mapOf(4 to 1, 6 to 3, 7 to 7)

    enum class Kind { TODAY, REVIEW }

    data class Entry(val kind: Kind, val word: Word, val daysAgo: Int, val image: String)

    private fun mod(a: Int, n: Int) = ((a % n) + n) % n

    fun dayIndex(date: LocalDate, epoch: String): Int =
        ChronoUnit.DAYS.between(LocalDate.parse(epoch), date).toInt()

    fun slot(time: LocalDateTime): Int = time.hour / SLOT_HOURS

    fun wordForDay(words: List<Word>, day: Int): Word = words[mod(day, words.size)]

    fun entry(words: List<Word>, day: Int, slot: Int): Entry {
        val ago = REVIEW_SLOTS[slot] ?: 0
        val w = wordForDay(words, day - ago)
        val imgs = w.images
        return Entry(
            kind = if (ago > 0) Kind.REVIEW else Kind.TODAY,
            word = w,
            daysAgo = ago,
            image = imgs[mod(day * SLOTS_PER_DAY + slot, imgs.size)],
        )
    }

    fun entry(content: ContentFile, now: LocalDateTime = LocalDateTime.now()): Entry =
        entry(content.words, dayIndex(now.toLocalDate(), content.epoch), slot(now))

    fun today(content: ContentFile, date: LocalDate = LocalDate.now()): Word =
        wordForDay(content.words, dayIndex(date, content.epoch))

    /** Bir sonraki dilimin başlangıcı (widget yenileme işi bu ana kurulur). */
    fun nextSlotStart(now: LocalDateTime): LocalDateTime =
        now.toLocalDate().atStartOfDay().plusHours(((slot(now) + 1) * SLOT_HOURS).toLong())

    /** Son [days] günün kelimeleri (bugün dahil, tekrarsız) — "Hatırla" testi bunlardan sorar. */
    fun recentWords(content: ContentFile, days: Int, date: LocalDate = LocalDate.now()): List<Word> {
        val today = dayIndex(date, content.epoch)
        return (0 until days).map { wordForDay(content.words, today - it) }.distinctBy { it.no }
    }
}
