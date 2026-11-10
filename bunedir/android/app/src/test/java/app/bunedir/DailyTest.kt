package app.bunedir

import app.bunedir.data.Content
import app.bunedir.data.Daily
import app.bunedir.data.Lexicon
import app.bunedir.data.Muse
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File
import java.time.LocalDate
import java.time.LocalDateTime

/** content/test-vectors.json'u (scripts/lib/daily.mjs üretir) Kotlin uygulamasıyla karşılaştırır. */
class DailyTest {
    private val contentDir = File("../../content")
    private val content = Content.parse(File(contentDir, "words.json").readText())
    private val lexicon = Lexicon.parse(File(contentDir, "dictionary.json").readText())
    private val pool = Lexicon.dailyPool(lexicon)

    @Test fun vektorlerJsIleAyni() {
        val arr = JSONObject(File(contentDir, "test-vectors.json").readText()).getJSONArray("vectors")
        assertTrue(arr.length() > 0)
        for (i in 0 until arr.length()) {
            val v = arr.getJSONObject(i)
            val date = v.getString("date")
            assertEquals(date, v.getInt("day"), Daily.dayIndex(LocalDate.parse(date), content.epoch))
            val e = Daily.entry(content.words, pool, v.getInt("day"), v.getInt("slot"))
            val at = "$date dilim ${v.getInt("slot")}"
            assertEquals(at, v.getString("kind"), e.kind.name.lowercase())
            assertEquals(at, v.getInt("no"), e.word.no)
            assertEquals(at, v.getInt("daysAgo"), e.daysAgo)
            assertEquals(at, v.getString("image"), e.image)
            assertEquals(at, if (v.isNull("dictId")) null else v.getString("dictId"), e.dict?.id)
        }
    }

    @Test fun icerikTamVeGorsellerVar() {
        assertEquals(50, content.words.size)
        content.words.flatMap { it.images + it.cover }.forEach { assertTrue(it, File(contentDir, it).exists()) }
    }

    @Test fun sonrakiDilim() {
        assertEquals(LocalDateTime.of(2026, 11, 9, 15, 0), Daily.nextSlotStart(LocalDateTime.of(2026, 11, 9, 14, 20)))
        assertEquals(LocalDateTime.of(2026, 11, 10, 0, 0), Daily.nextSlotStart(LocalDateTime.of(2026, 11, 9, 23, 59)))
        assertEquals(LocalDateTime.of(2026, 11, 9, 3, 0), Daily.nextSlotStart(LocalDateTime.of(2026, 11, 9, 0, 0)))
    }

    @Test fun sonKelimelerTekrarsiz() {
        val recent = Daily.recentWords(content, 14, LocalDate.of(2026, 11, 9))
        assertEquals(14, recent.map { it.no }.toSet().size)
        assertEquals(Daily.today(content, LocalDate.of(2026, 11, 9)), recent.first())
    }

    @Test fun kirpmaAltaYakin() {
        // 1080 kare → orta widget (2.1:1): 514 yükseklik, (1080-514)*0.8 = 453 aşağıdan başlar
        assertTrue(Content.cropRect(1080, 1080, 2.1f)!!.contentEquals(intArrayOf(0, 453, 1080, 514)))
        assertTrue(Content.cropRect(1080, 540, 1f)!!.contentEquals(intArrayOf(270, 0, 540, 540)))
        assertEquals(null, Content.cropRect(1080, 1080, 1f))
    }

    @Test fun ilhamMotoruJsIleAyni() {
        val arr = JSONObject(File(contentDir, "muse-vectors.json").readText()).getJSONArray("vectors")
        val prepared = Muse.prepare(lexicon)
        assertTrue(arr.length() > 20)
        for (i in 0 until arr.length()) {
            val v = arr.getJSONObject(i)
            val text = v.getString("text")
            val s = Muse.suggest(prepared, text)
            if (v.isNull("result")) assertEquals(text, null, s)
            else {
                val r = v.getJSONObject("result")
                assertEquals(text, r.getString("kind"), s?.kind?.name?.lowercase())
                assertEquals(text, r.getString("id"), s?.entry?.id)
                assertEquals(text, r.getString("token"), s?.token)
            }
        }
    }

    @Test fun sozlukBinKelime() {
        assertTrue(lexicon.size >= 1000)
        assertTrue(lexicon.count { it.origin == "Japonca" } >= 100)
        assertEquals(50, lexicon.count { it.episode != null })
        assertEquals("Saudade", Lexicon.search(lexicon, "saudade").first().word)
        assertEquals("istanbul işik ikigai", Muse.fold("İSTANBUL Işık Ikigai"))
    }
}
