package app.bunedir.data

import android.content.Context
import app.bunedir.BuildConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL

data class TrialCode(val code: String, val trialDays: Int, val redeemed: Boolean)

class AccountException(message: String) : Exception(message)

/**
 * E-posta + 6 haneli kod (Supabase Auth OTP) ile kayıt → diğer uygulama için 2 aylık deneme kodu.
 * Uygulamanın hiçbir özelliği kayda bağlı değil. Hesap silme uygulama içinden (Play politikası).
 */
class Account(context: Context) {
    private val prefs = context.getSharedPreferences("account", Context.MODE_PRIVATE)
    private val base = BuildConfig.SUPABASE_URL.trimEnd('/')
    private val anon = BuildConfig.SUPABASE_ANON_KEY

    val enabled get() = base.isNotEmpty() && anon.isNotEmpty()
    val email: String? get() = prefs.getString("email", null)
    val trial: TrialCode?
        get() = prefs.getString("code", null)?.let {
            TrialCode(it, prefs.getInt("days", TRIAL_DAYS), prefs.getBoolean("redeemed", false))
        }

    suspend fun sendCode(raw: String) {
        val email = raw.trim().lowercase()
        if (!Regex("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$").matches(email)) throw AccountException("Geçerli bir e-posta adresi yaz.")
        auth("otp", JSONObject().put("email", email).put("create_user", true))
        prefs.edit().putString("email", email).apply()
    }

    suspend fun verify(code: String): TrialCode {
        val email = email ?: throw AccountException("Önce e-posta adresini yaz.")
        val tokens = try {
            auth("verify", JSONObject().put("type", "email").put("email", email).put("token", code.filter(Char::isDigit)))
        } catch (e: AccountException) {
            throw AccountException("Kod hatalı ya da süresi dolmuş. Yeni kod iste.")
        }
        storeTokens(tokens)
        return refreshTrial()
    }

    suspend fun refreshTrial(): TrialCode {
        val o = JSONObject(function("GET"))
        val t = TrialCode(o.getString("code"), o.optInt("trial_days", TRIAL_DAYS), o.optBoolean("redeemed", false))
        prefs.edit().putString("code", t.code).putInt("days", t.trialDays).putBoolean("redeemed", t.redeemed).apply()
        return t
    }

    suspend fun deleteAccount() {
        function("DELETE")
        prefs.edit().clear().apply()
    }

    private fun storeTokens(o: JSONObject) {
        prefs.edit().putString("access", o.getString("access_token")).putString("refresh", o.getString("refresh_token")).apply()
    }

    private suspend fun auth(path: String, body: JSONObject): JSONObject {
        val (status, text) = http("POST", "$base/auth/v1/$path", body.toString(), bearer = null)
        if (status !in 200..299) throw AccountException("Bir şeyler ters gitti ($status). Biraz sonra tekrar dene.")
        return if (text.isBlank()) JSONObject() else JSONObject(text)
    }

    private suspend fun function(method: String, retry: Boolean = true): String {
        if (!enabled) throw AccountException("Kayıt şu an kapalı.")
        val token = prefs.getString("access", null) ?: throw AccountException("Önce giriş yap.")
        val (status, text) = http(method, "$base/functions/v1/bunedir-trial", null, bearer = token)
        val refresh = prefs.getString("refresh", null)
        if (status == 401 && retry && refresh != null) {
            // Erişim jetonu 1 saatte dolar; yenileyip bir kez daha dene.
            storeTokens(auth("token?grant_type=refresh_token", JSONObject().put("refresh_token", refresh)))
            return function(method, retry = false)
        }
        if (status !in 200..299) throw AccountException("Bir şeyler ters gitti ($status). Biraz sonra tekrar dene.")
        return text
    }

    private suspend fun http(method: String, url: String, body: String?, bearer: String?): Pair<Int, String> =
        withContext(Dispatchers.IO) {
            try {
                val c = URL(url).openConnection() as HttpURLConnection
                c.requestMethod = method
                c.connectTimeout = 15_000
                c.readTimeout = 15_000
                c.setRequestProperty("apikey", anon)
                c.setRequestProperty("content-type", "application/json")
                bearer?.let { c.setRequestProperty("authorization", "Bearer $it") }
                if (body != null) {
                    c.doOutput = true
                    c.outputStream.use { it.write(body.toByteArray()) }
                }
                val status = c.responseCode
                val stream = if (status in 200..299) c.inputStream else c.errorStream
                status to (stream?.bufferedReader()?.use { it.readText() } ?: "")
            } catch (e: IOException) {
                throw AccountException("Bağlantı kurulamadı. İnternetini kontrol edip tekrar dene.")
            }
        }

    companion object { const val TRIAL_DAYS = 60 }
}
