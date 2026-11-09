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
    fun bitmap(context: Context, path: String, maxPx: Int = 720): Bitmap? = runCatching {
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        context.assets.open(path).use { BitmapFactory.decodeStream(it, null, bounds) }
        var sample = 1
        while (maxOf(bounds.outWidth, bounds.outHeight) / (sample * 2) >= maxPx) sample *= 2
        val opts = BitmapFactory.Options().apply { inSampleSize = sample }
        context.assets.open(path).use { BitmapFactory.decodeStream(it, null, opts) }
    }.getOrNull()

    fun instagramUrl(context: Context, word: Word): String = word.reel ?: get(context).instagram
}
