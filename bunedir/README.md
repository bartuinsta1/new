# Bu Nedir? · Günün Kelimesi widget'ı

Instagram'daki **@bu.nedir1** ("Bu Nedir? – Hikâyelerle Kelimeler") hikâyelerinin ücretsiz widget uygulaması.
iOS (App Store) ve Android (Google Play).

- **Widget her gün bir kelime gösterir.** Arka plan, o bölümün video sahneleri arasında gün boyu (3 saatte bir) değişir.
- **Öğretmeye devam eder:** saat 12:00'de dünün, 18:00'de 3 gün öncesinin, 21:00'de geçen haftanın kelimesini
  "Hatırla" kartı olarak geri getirir (aralıklı tekrar). Uygulama hiç açılmasa da çalışır.
- **1000 kelimelik hafıza:** 50 bölüm + 955 kelime (122 Japonca; Arapça/Farsça kökenli, Anadolu Türkçesi ve
  dünya dillerinden). Uygulamada aramalı sözlük; widget her öğleden sonra (15:00) sözlükten bir kelime gösterir.
- **İlham klavyesi (iOS klavye eklentisi + Android klavye):** Hangi uygulamada yazılırsa yazılsın klavyenin üstündeki
  şerit konuşur: "özledim" → *Buna "saudade" denir*, "lagom" → *Bu budur: Lagom*, boştayken bir tek söz.
  **Yazılanlar cihazdan çıkmaz:** iOS'ta "Tam Erişim" istenmez (ağ yok), Android'de klavye hiçbir şey kaydetmez/göndermez.
  Başka uygulamalardaki *gelen* mesajları okumak her iki mağazada da mümkün/izinli değil; bu yüzden klavye yolu seçildi.
- **Uygulama:** Günün kelimesi (sahneler, anlam, kısa hikâye, tek söz, "Instagram'da izle"), 50 kelimelik arşiv,
  "Hatırla" testi, isteğe bağlı günlük bildirim.
- **2 ay hediye:** E-postayla (parolasız, 6 haneli kod) kaydolan herkes, yakında çıkacak diğer uygulamamızda
  **60 gün ücretsiz** kullanım kodu alır (`BN-XXXX-XXXX`). Bu uygulamanın hiçbir özelliği kayda bağlı değildir.
- Ücretsiz, reklamsız, üçüncü taraf SDK yok.

```
bunedir/
  content/          words.json (50 bölüm) + covers/ + scenes/ + sozluk/*.tsv (sözlük kaynakları)
                    + dictionary.json (üretilir) + test-vectors.json + muse-vectors.json (üretilir)
  scripts/          extract-scenes.mjs (video → sahne), check-content.mjs (doğrula), lib/daily.mjs (kuralın referansı)
  ios/              SwiftUI uygulama + WidgetKit eklentisi (XcodeGen)
  android/          Compose uygulama + Glance widget + WorkManager
  backend/          Supabase Edge Function: bunedir-trial (deneme kodu) + migration + testler
```

İçerik klasörü kopyalanmaz: iOS paketine `content/` olarak, Android'de `assets/` köküne doğrudan girer.

## Yeni bölüm / görsel eklemek

1. `content/words.json`'a kelimeyi ekle (`meaning` ≤ 140, `oneLiner` ≤ 70, `story` ≤ 320 karakter — widget'a sığsın).
   Reels yayınlanınca `reel` alanına bağlantısını yaz; boşsa "Instagram'da izle" profili açar.
2. Kapak: `content/covers/NN.jpg`. Şu an 50 kapak, kapak kareleri görselinden kesildi (küçük çözünürlük, ~146×260).
   **Yayından önce her bölümün kapağını 1080×1920 dışa aktarıp üzerine yazın.**
3. Sahneler (widget arka planı):
   ```bash
   node scripts/extract-scenes.mjs ~/Videolar/bnd-09-teavun.mp4 9                  # sahne geçişlerini kendisi bulur
   node scripts/extract-scenes.mjs ~/Videolar/bnd-07-dirlik.mov 7 --times 0.5,8,20,30
   ```
   Altyazı kartının üstünde kalan kare bölgeyi 1080×1080 kırpar. En temizi: kurgudan **altyazısız** kareleri
   `content/scenes/NN-1.jpg …` olarak koymak ve `words.json`'daki `scenes` listesine yazmak. Şu an 07 Dirlik ve 09 Teavün hazır.
4. `node scripts/check-content.mjs` → doğrular ve `test-vectors.json`'u günceller (iOS/Android testleri bunu kullanır).

Günün kelimesi herkeste aynıdır: `words.json` → `epoch` gününden beri geçen gün sayısı mod kelime sayısı
(1 Ocak 2026 = 1. kelime). Instagram'da "bugünün kelimesi" diye paylaşılabilir.

## Sözlüğe kelime eklemek

`content/sozluk/*.tsv` dosyalarına `kelime | köken | anlam | tetikleyiciler` satırı ekleyin (ayrıntı: `content/sozluk/README.md`).
Tetikleyiciler, klavyenin "buna X denir" demesi için Türkçe köklerdir (`özle` → özledim, özlem…).
Gündelik kelimeler (`yaygin.txt`) sözlükte durur ama klavye onlar için konuşmaz.

```bash
node scripts/build-dictionary.mjs && node scripts/check-content.mjs   # sözlüğü ve test vektörlerini üret
```

Klavye kuralı (`scripts/lib/muse.mjs`): yalnızca bir kelime bitince (boşluk/noktalama) son cümleye bakar; önce sözlükteki
bir kelimenin kendisi ("bu budur"), yoksa tetikleyici ("buna X denir"). iOS (`Shared/Lexicon.swift`) ve Android
(`data/Lexicon.kt`) aynı `muse-vectors.json` ile test edilir.

## iOS

```bash
cd ios && brew install xcodegen && xcodegen generate && open BuNedir.xcodeproj
```
- `Config.local.xcconfig` (git'e girmez): `BUNEDIR_SUPABASE_URL`, `BUNEDIR_SUPABASE_ANON_KEY`, `DEVELOPMENT_TEAM`.
  Boşsa hediye ekranı "çok yakında" der; uygulamanın geri kalanı çalışır.
- Bundle ID'ler: `app.bunedir.ios`, `app.bunedir.ios.widget` (değiştirmek için `project.yml`).
- Klavye: `BuNedirKeyboard` eklentisi (`app.bunedir.ios.keyboard`), Türkçe Q düzeni, `RequestsOpenAccess = false`.
- Widget: küçük, orta, büyük + kilit ekranı (dikdörtgen, satır içi). Dokununca o kelimenin sayfası açılır (`bunedir://word/9`).
- Testler: `./ci-test.sh` (JS ile aynı test vektörleri).

## Android

```bash
cd android && cp local.properties.example local.properties   # sdk.dir + Supabase
./gradlew testDebugUnitTest assembleDebug
./gradlew bundleRelease   # Play Console için .aab (imza: local.properties ya da BUNEDIR_KEYSTORE* ortam değişkenleri)
```
- Paket: `app.bunedir.android`, minSdk 26.
- Widget her 3 saatlik dilimin başında WorkManager ile yeniden çizilir (Doze'da birkaç dakika gecikebilir);
  `updatePeriodMillis` 3 saatlik yedek. Günlük bildirim aynı işte gönderilir (06/09/12/15/18/21 seçenekleri).

## Backend: 2 ay hediye kodu

Supabase (ücretsiz katman yeter). Kayıt, Supabase Auth'un e-posta OTP'si ile; kod tablosu RLS ile istemcilere kapalı.

```bash
cd backend
supabase link --project-ref <proje>
supabase db push                                   # trial_codes tablosu
supabase secrets set PARTNER_SECRET=$(openssl rand -hex 32)
supabase functions deploy bunedir-trial
npm test                                           # Node 22+, bağımlılık yok
```
Supabase panelinde **Authentication → Email Templates → Magic Link** şablonunu `{{ .Token }}` (6 haneli kod) gösterecek
şekilde düzenleyin; uygulama bağlantı değil kod bekler.

| Uç nokta | Kim çağırır | Ne yapar |
|---|---|---|
| `GET /functions/v1/bunedir-trial` | Bu Nedir? uygulaması (kullanıcı JWT) | Kodu döndürür, yoksa üretir: `{ code, trial_days: 60, redeemed }` |
| `DELETE /functions/v1/bunedir-trial` | Bu Nedir? uygulaması | Hesabı ve kodu siler (App Store / Play hesap silme şartı) |
| `POST /functions/v1/bunedir-trial/redeem` | **Diğer uygulamanın sunucusu** (`x-partner-secret`) | `{ code, partner_user_id }` → `{ trial_days, trial_ends_at }`; kod bir kez kullanılır, aynı kişinin tekrarı aynı tarihi döndürür |

**Diğer uygulamada nasıl kullanılır:** kullanıcı kodu girer → o uygulamanın sunucusu `/redeem`'i çağırır → dönen
`trial_ends_at`'e kadar Premium'u sunucu tarafında açar. Gizli anahtar asla uygulamaya gömülmez.

> Mağaza kuralı notu: Ücretsiz deneme sunucu tarafı hak olarak verilir (iki uygulamada da para alınmıyor), bu
> serbest. Diğer uygulama abonelikleri App Store/Play üzerinden satacaksa alternatif olarak **App Store Offer Code**
> ("2 ay ücretsiz" özel kod) ve **Play promosyon kodu** da kullanılabilir; o durumda `/redeem` yanıtına mağaza kodu
> eklemek yeterli.

## Yayın kontrol listesi

- [ ] Kapakları ve sahneleri tam çözünürlükte koy (yukarıda).
- [ ] Gizlilik politikası sayfası (uygulamada `https://bunedir.app/gizlilik` bağlantısı var — alan adını güncelle).
      Toplanan veri yalnızca e-posta (hediye kodu için), izleme yok.
- [ ] App Store: Gizlilik etiketi → "İletişim bilgisi: e-posta, uygulama işlevi için, kimlikle ilişkili, izleme yok".
      Kategori Eğitim. Ekran görüntülerinde widget'ı göster (inceleme ekibi widget'ı görmek ister).
- [ ] Play: Veri güvenliği formu (e-posta, isteğe bağlı, silinebilir), hesap silme bağlantısı (uygulama içi + web).
- [ ] Supabase: e-posta şablonu (OTP), SMTP (Supabase'in varsayılanı saatte birkaç e-postayla sınırlı — Resend/SES bağla).
- [ ] Instagram bio'suna mağaza bağlantıları.
