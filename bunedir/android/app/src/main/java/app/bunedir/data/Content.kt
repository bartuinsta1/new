package app.bunedir.data

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import org.json.JSONObject

/** content/words.json'daki bir bölüm. Uygulama ve widget aynı assets içeriğini okur. */
data class Word(
    val no: Int,
    val slug: String,
    val word: String,
    val origin: String,
    val meaning: String,
    val oneLiner: String,
    val story: String,
    val cover: String,
    val scenes: List<String>,
    val reel: String?,
) {
    /** Widget arka planı olarak dönen görseller: sahneler, yoksa kapak. */
    val images: List<String> get() = scenes.ifEmpty { listOf(cover) }
}

data class ContentFile(val epoch: String, val instagram: String, val words: List<Word>)

object Content {
    @Volatile private var cached: ContentFile? = null

    fun get(context: Context): ContentFile = cached ?: synchronized(this) {
        cached ?: parse(context.assets.open("words.json").bufferedReader().use { it.readText() }).also { cached = it }
    }

    fun parse(json: String): ContentFile {
        val root = JSONObject(json)
        val arr = root.getJSONArray("words")
        val words = (0 until arr.length()).map { i ->
            val o = arr.getJSONObject(i)
            val scenes = o.getJSONArray("scenes")
            Word(
                no = o.getInt("no"),
                slug = o.getString("slug"),
                word = o.getString("word"),
                origin = o.getString("origin"),
                meaning = o.getString("meaning"),
                oneLiner = o.getString("oneLiner"),
                story = o.getString("story"),
                cover = o.getString("cover"),
                scenes = (0 until scenes.length()).map { scenes.getString(it) },
                reel = if (o.isNull("reel")) null else o.getString("reel"),
            )
        }.sortedBy { it.no }
        return ContentFile(root.getString("epoch"), root.getString("instagram"), words)
    }

    /** Görseli en büyük kenarı ~maxPx olacak şekilde küçülterek yükler (widget bitmap sınırı için). */
    /** [aspect] (genişlik/yükseklik) verilirse o orana kırpar; dikeyde alta yakın (karakterler karenin altında). */
    fun bitmap(context: Context, path: String, maxPx: Int = 720, aspect: Float? = null): Bitmap? = runCatching {
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        context.assets.open(path).use { BitmapFactory.decodeStream(it, null, bounds) }
        var sample = 1
        while (maxOf(bounds.outWidth, bounds.outHeight) / (sample * 2) >= maxPx) sample *= 2
        val opts = BitmapFactory.Options().apply { inSampleSize = sample }
        val full = context.assets.open(path).use { BitmapFactory.decodeStream(it, null, opts) }!!
        val r = aspect?.let { cropRect(full.width, full.height, it) } ?: return@runCatching full
        Bitmap.createBitmap(full, r[0], r[1], r[2], r[3])
    }.getOrNull()

    /** [x, y, genişlik, yükseklik] ya da oran zaten tutuyorsa null. iOS: Content.cropRect ile aynı. */
    fun cropRect(w: Int, h: Int, aspect: Float): IntArray? {
        val ratio = w.toFloat() / h
        return when {
            ratio > aspect -> { val cw = Math.round(h * aspect); intArrayOf(Math.round((w - cw) / 2f), 0, cw, h) }
            ratio < aspect -> { val ch = Math.round(w / aspect); intArrayOf(0, Math.round((h - ch) * 0.8f), w, ch) }
            else -> null
        }
    }

    fun instagramUrl(context: Context, word: Word): String = word.reel ?: get(context).instagram
}
