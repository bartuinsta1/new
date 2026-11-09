package app.bunedir.keyboard

import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.inputmethodservice.InputMethodService
import android.os.Handler
import android.os.Looper
import android.text.TextUtils
import android.util.TypedValue
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import android.view.inputmethod.EditorInfo
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import app.bunedir.data.Content
import app.bunedir.data.DictEntry
import app.bunedir.data.Lexicon
import app.bunedir.data.Muse
import java.util.Locale

/**
 * "Bu Nedir?" ilham klavyesi. Yazılanı yalnızca cihazda okur; hiçbir metin kaydedilmez ya da gönderilmez.
 * Sözlükten bir kelime yakalarsa "Bu budur", bir his yakalarsa "Buna X denir" der; boştayken bir tek söz fısıldar.
 */
class MuseKeyboardService : InputMethodService() {
    private enum class Layer { LETTERS, NUMBERS, SYMBOLS }
    private enum class Shift { OFF, ONCE, LOCKED }

    private var layer = Layer.LETTERS
    private var shift = Shift.ONCE
    private var expanded: DictEntry? = null
    private var suggestion: Muse.Suggestion? = null

    private lateinit var root: LinearLayout
    private lateinit var strip: LinearLayout
    private lateinit var stripTitle: TextView
    private lateinit var stripBody: TextView
    private lateinit var body: LinearLayout

    private val prepared by lazy { Muse.prepare(Lexicon.get(this)) }
    private val tr = Locale("tr", "TR")
    private val handler = Handler(Looper.getMainLooper())

    private val paper = Color.parseColor("#F4EEE1")
    private val ink = Color.parseColor("#2B2622")
    private val accent = Color.parseColor("#B07A2A")
    private val board = Color.parseColor("#EDE8DB")
    private val special = Color.parseColor("#C7BFB2")

    private val letters = listOf(
        listOf("q", "w", "e", "r", "t", "y", "u", "ı", "o", "p", "ğ", "ü"),
        listOf("a", "s", "d", "f", "g", "h", "j", "k", "l", "ş", "i"),
        listOf("z", "x", "c", "v", "b", "n", "m", "ö", "ç"),
    )
    private val numbers = listOf(
        listOf("1", "2", "3", "4", "5", "6", "7", "8", "9", "0"),
        listOf("-", "/", ":", ";", "(", ")", "₺", "&", "@", "\""),
        listOf(".", ",", "?", "!", "'"),
    )
    private val symbols = listOf(
        listOf("[", "]", "{", "}", "#", "%", "^", "*", "+", "="),
        listOf("_", "\\", "|", "~", "<", ">", "€", "$", "£", "•"),
        listOf(".", ",", "?", "!", "'"),
    )

    private fun dp(v: Int) = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v.toFloat(), resources.displayMetrics).toInt()

    override fun onCreateInputView(): View {
        root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(board)
            setPadding(0, 0, 0, dp(4))
        }
        strip = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(paper)
            setPadding(dp(12), dp(4), dp(12), dp(4))
            gravity = Gravity.CENTER_VERTICAL
            setOnClickListener { suggestion?.let { expanded = it.entry; render() } }
        }
        stripTitle = TextView(this).apply { setTextColor(accent); setTypeface(typeface, Typeface.BOLD); textSize = 14f; maxLines = 1; ellipsize = TextUtils.TruncateAt.END }
        stripBody = TextView(this).apply { setTextColor(ink); textSize = 12f; maxLines = 2; ellipsize = TextUtils.TruncateAt.END }
        strip.addView(stripTitle)
        strip.addView(stripBody)
        root.addView(strip, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(52)))
        body = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        root.addView(body, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(4 * 52 + 8)))
        render()
        return root
    }

    override fun onStartInputView(info: EditorInfo?, restarting: Boolean) {
        super.onStartInputView(info, restarting)
        expanded = null
        layer = Layer.LETTERS
        refresh()
    }

    override fun onUpdateSelection(oldSelStart: Int, oldSelEnd: Int, newSelStart: Int, newSelEnd: Int, candidatesStart: Int, candidatesEnd: Int) {
        super.onUpdateSelection(oldSelStart, oldSelEnd, newSelStart, newSelEnd, candidatesStart, candidatesEnd)
        refresh()
    }

    private fun before(): String = currentInputConnection?.getTextBeforeCursor(240, 0)?.toString() ?: ""

    private fun refresh() {
        if (!::root.isInitialized) return
        val text = before()
        val s = Muse.suggest(prepared, text)
        if (s != null) suggestion = s
        else if (text.isEmpty() || text.endsWith(". ") || text.endsWith("\n")) suggestion = null
        val t = text.trimEnd(' ')
        if ((t.isEmpty() || t.endsWith('.') || t.endsWith('!') || t.endsWith('?') || text.endsWith("\n")) && shift == Shift.OFF) shift = Shift.ONCE
        render()
    }

    private fun render() {
        val s = suggestion
        if (s != null) {
            stripTitle.text = if (s.kind == Muse.Kind.WORD) "Bu budur: ${s.entry.word}" else "Buna “${s.entry.word}” denir"
            stripBody.text = s.entry.meaning
            stripTitle.visibility = View.VISIBLE
        } else {
            stripTitle.visibility = View.GONE
            stripBody.text = Muse.idleLine(Content.get(this))
        }
        body.removeAllViews()
        val e = expanded
        if (e != null) renderCard(e) else renderKeys()
    }

    private fun renderCard(e: DictEntry) {
        val card = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(paper)
            setPadding(dp(16), dp(12), dp(16), dp(12))
        }
        card.addView(TextView(this).apply { text = e.word; textSize = 26f; setTextColor(accent); typeface = Typeface.create(Typeface.SERIF, Typeface.BOLD) })
        card.addView(TextView(this).apply { text = e.origin; textSize = 12f; setTextColor(ink); alpha = 0.6f })
        card.addView(TextView(this).apply { text = e.meaning; textSize = 16f; setTextColor(ink); setPadding(0, dp(6), 0, dp(6)) })
        val buttons = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
        buttons.addView(Button(this).apply {
            text = "Yazıya ekle"; setTextColor(Color.WHITE); background = rounded(accent)
            setOnClickListener {
                val b = before()
                val sep = if (b.isEmpty() || b.endsWith(" ") || b.endsWith("\n")) "" else " "
                currentInputConnection?.commitText("$sep${e.word} ", 1)
                expanded = null; refresh()
            }
        })
        buttons.addView(Button(this).apply { text = "Kapat"; setTextColor(ink); background = rounded(special); setOnClickListener { expanded = null; render() } },
            LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { marginStart = dp(8) })
        card.addView(buttons)
        body.addView(card, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
    }

    private fun rows() = when (layer) { Layer.LETTERS -> letters; Layer.NUMBERS -> numbers; Layer.SYMBOLS -> symbols }

    private fun renderKeys() {
        val r = rows()
        body.addView(row(r[0].map { charKey(it) }))
        body.addView(row(r[1].map { charKey(it) }))
        val third = mutableListOf<View>()
        third += if (layer == Layer.LETTERS) {
            specialKey(when (shift) { Shift.OFF -> "⇧"; Shift.ONCE -> "⬆"; Shift.LOCKED -> "⇪" }, 1.4f) {
                shift = when (shift) { Shift.OFF -> Shift.ONCE; Shift.ONCE -> Shift.LOCKED; Shift.LOCKED -> Shift.OFF }; render()
            }
        } else {
            specialKey(if (layer == Layer.NUMBERS) "#+=" else "123", 1.4f) { layer = if (layer == Layer.NUMBERS) Layer.SYMBOLS else Layer.NUMBERS; render() }
        }
        third += r[2].map { charKey(it) }
        third += deleteKey()
        body.addView(row(third))
        body.addView(row(listOf(
            specialKey(if (layer == Layer.LETTERS) "123" else "ABC", 1.5f) { layer = if (layer == Layer.LETTERS) Layer.NUMBERS else Layer.LETTERS; render() },
            specialKey("boşluk", 5f, light = true) { currentInputConnection?.commitText(" ", 1); refresh() },
            specialKey("⏎", 1.5f) { enter() },
        )))
    }

    private fun enter() {
        val ic = currentInputConnection ?: return
        val action = currentInputEditorInfo?.imeOptions?.and(EditorInfo.IME_MASK_ACTION) ?: EditorInfo.IME_ACTION_NONE
        val noEnterAction = ((currentInputEditorInfo?.imeOptions ?: 0) and EditorInfo.IME_FLAG_NO_ENTER_ACTION) != 0
        if (action != EditorInfo.IME_ACTION_NONE && action != EditorInfo.IME_ACTION_UNSPECIFIED && !noEnterAction) ic.performEditorAction(action)
        else ic.commitText("\n", 1)
        refresh()
    }

    private fun row(keys: List<View>) = LinearLayout(this).apply {
        orientation = LinearLayout.HORIZONTAL
        setPadding(dp(2), dp(4), dp(2), dp(0))
        keys.forEach { addView(it) }
        layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(52))
    }

    private fun rounded(color: Int) = GradientDrawable().apply { setColor(color); cornerRadius = dp(6).toFloat() }

    private fun keyView(label: String, weight: Float, color: Int, size: Float) = TextView(this).apply {
        text = label
        gravity = Gravity.CENTER
        textSize = size
        setTextColor(ink)
        background = rounded(color)
        layoutParams = LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.MATCH_PARENT, weight).apply { setMargins(dp(2), 0, dp(2), dp(4)) }
        contentDescription = label
    }

    private fun charKey(k: String): View {
        val label = if (layer == Layer.LETTERS && shift != Shift.OFF) k.uppercase(tr) else k
        return keyView(label, 1f, Color.WHITE, 20f).apply {
            setOnClickListener {
                currentInputConnection?.commitText(label, 1)
                if (shift == Shift.ONCE) shift = Shift.OFF
                refresh()
            }
        }
    }

    private fun specialKey(label: String, weight: Float, light: Boolean = false, action: () -> Unit) =
        keyView(label, weight, if (light) Color.WHITE else special, 15f).apply { setOnClickListener { action() } }

    /** Basılı tutunca tekrar eden sil tuşu. */
    private fun deleteKey(): View = keyView("⌫", 1.4f, special, 18f).apply {
        val repeat = object : Runnable {
            override fun run() { delete(); handler.postDelayed(this, 70) }
        }
        setOnTouchListener { v, ev ->
            when (ev.action) {
                MotionEvent.ACTION_DOWN -> { delete(); handler.postDelayed(repeat, 400) }
                MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> { handler.removeCallbacks(repeat); v.performClick(); refresh() }
            }
            true
        }
    }

    private fun delete() {
        val ic = currentInputConnection ?: return
        val selected = ic.getSelectedText(0)
        if (!selected.isNullOrEmpty()) ic.commitText("", 1) else ic.deleteSurroundingTextInCodePoints(1, 0)
    }
}
