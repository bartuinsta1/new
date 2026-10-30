# Masalcık backend

Supabase Edge Functions (Deno) + Postgres. Testler Node 22 ile, Deno gerekmeden çalışır.

```bash
npm install
npm run check        # tür denetimi + testler + çeviri bütünlüğü
```

## Masal motoru (Adım 5)

- **Model:** Claude Haiku 5.5 (`claude-haiku-5-5`) — en düşük maliyetli güncel Claude modeli.
  Masal başına tahmini maliyet ~0,002–0,004 $ (yazım + moderasyon; seslendirme hariç).
- **Hat:** girdi temizleme → üretim (sistem promptu + JSON şeması) → kural denetimi → ikinci model çağrısıyla
  moderasyon → sorun varsa bir kez yeniden üretim → yine olmazsa hazır güvenli masal. Çocuk hata görmez.
- **Önbellek:** sistem promptu her istekte aynı (prompt caching); üretilen masal saklanır, tekrar dinlemede
  yeniden üretilmez; `Idempotency-Key` ile tekrarlanan istek kota düşmez.
- **Maliyet panosu:** `GET /admin-costs?days=30` (`Authorization: Bearer $ADMIN_TOKEN`).

Kod: `supabase/functions/_shared/engine/` — `prompt.ts` (yazım kuralları, TR/EN), `schema.ts` (JSON şeması),
`safety.ts` (girdi/çıktı denetimi), `llm.ts` (Claude adaptörü), `engine.ts` (akış), `store.ts` (kalıcılık).

## Seslendirme (Adım 6)

- **Sağlayıcı:** Azure Neural TTS (`tr-TR-EmelNeural`, `tr-TR-AhmetNeural`, `en-US-AvaNeural`, `en-US-AndrewNeural`);
  Anne/Baba/Nine/Dede tonları SSML ile (~%85 hız; Nine/Dede daha yavaş ve pes), paragraf duygusuna göre hafif ton.
  Ebeveynin klon sesi (Premium) ElevenLabs ile. Sağlayıcı `TtsProvider` arayüzünün arkasında, değiştirilebilir.
- **Akış:** masal güvenlik denetiminden geçince paragraflar sırayla seslendirilir; her biri hazır olur olmaz istemciye
  gider. Seslendirilemeyen paragrafın `audio_url`'i boş gelir, uygulama onu cihaz sesiyle okur.
- **Önbellek:** aynı metin + aynı ses → aynı dosya (`tts/<sha256>.mp3`); tekrar seslendirme ve maliyet yok.
  Ses dosyaları çocuğun adını içerdiği için üretimde özel kova + imzalı URL kullanılmalı.
- **Maliyet:** gerçekten seslendirilen karakter sayısı ayrı bir `tts` kaydıyla loglanır; panoda `ttsCostUSD`.

### Sırlar

```bash
supabase secrets set ANTHROPIC_API_KEY=...   # tanımlı değilse fonksiyon sahte masal döner
supabase secrets set ADMIN_TOKEN=...          # maliyet panosu
supabase secrets set STORY_EFFORT=low         # isteğe bağlı: low (varsayılan) | medium | high
supabase secrets set AZURE_TTS_KEY=... AZURE_TTS_REGION=westeurope   # yoksa uygulama cihaz sesiyle okur
supabase secrets set ELEVENLABS_API_KEY=...   # isteğe bağlı: ebeveyn klon sesi
```

## Abonelik ve ücretsiz limitler (Adım 10)

- **`POST /entitlements/verify`**: StoreKit 2 işlem JWS'i (`signed_transaction`) ya da geri yüklemede liste
  (`signed_transactions`, en çok 10). İmza + x5c zinciri (Apple Root CA G3 parmak izi sabit, WWDR ve alındı
  OID'leri), paket kimliği ve ortam doğrulanır (`_shared/appstore.ts`, bağımlılıksız). Bir abonelik aynı anda
  tek hesabı açar; geri yükleme aboneliği yeni (anonim) hesaba taşır.
- **`POST /appstore-notifications`**: App Store Server Notifications V2 (App Store Connect › Uygulama ›
  App Store Server Notifications › Production/Sandbox URL). Yenileme uzatır; iade/iptal/süre bitişi kapatır.
- **Limitler sunucuda:** ücretsiz günde 1 kişisel masal, kitaplıktan haftada 3 *farklı* masal
  (`GET /library/:id`, Türkiye saatiyle pazartesi başlar; tekrar dinleme sayılmaz; `is_free` olmayanlar 402).
  Premium: günde 10 kişisel masal (adil kullanım).
- **Yerel geliştirme:** `APPLE_BUNDLE_ID` yoksa doğrulayıcı kapalıdır ve yalnızca `mock-...` işlemler kabul
  edilir. Xcode'un yerel StoreKit testi (`StoreKit/Masalcik.storekit`) yerel sertifikayla imzalar; gerçek
  doğrulayıcı bunları reddeder (doğru davranış) — Xcode'da sahte backend ile deneyin, Sandbox'ta gerçekle.
- **Üretimden önce:** `APPLE_ROOT_CA_G3_SHA256` değerini apple.com/certificateauthority'den indirilen
  sertifikayla teyit edin (bu ortamdan erişilemedi).

```bash
supabase secrets set APPLE_BUNDLE_ID=com.masalcik.app
supabase secrets set APPSTORE_ENVIRONMENTS=Production,Sandbox   # App Review sandbox'ta satın alır
```

## Masal Dükkanı (tek seferlik paketler)

Katalog `_shared/packs.ts` (fiyat App Store'dan). `GET /library/packs` katalog + sahiplik; paket masalları
(`pack_id`) yalnızca paketi alana açılır (402 `pack_required`), Premium'a dahil değildir ve haftalık hakkı harcamaz.
Satın alma `POST /entitlements/verify` ile doğrulanır (Non-Consumable işlem → `purchases` tablosu; yanıtta
`owned_products`). İade bildirimi sahipliği kaldırır; geri yükleme sahipliği yeni hesaba taşır.

## Kalıcılık (Postgres)

`SUPABASE_DB_URL` tanımlıysa (Supabase Edge Functions bunu kendiliğinden verir) tüm depolar Postgres'tedir
(`_shared/pg/stores.ts`); yoksa bellek içi (yalnızca yerel geliştirme — veriler fonksiyonlar arasında paylaşılmaz).
`USE_MEMORY_STORES=1` bellek içini zorlar. Sunucu yalnızca anonim kullanıcı kimliğiyle çalışır (aile ve çocuk
profilleri cihazda); hesap silmede `auth.users` satırı silinir, her şey cascade ile gider.
Not: Postgres'te kullanıcı kimlikleri UUID'dir; `MOCK_AUTH=1` ile ("Bearer user-1") yalnızca bellek içi depolar çalışır.

```bash
# Gerçek Postgres'te depo testleri (yerel Postgres 15+; masalcik_test veritabanını sıfırdan kurar)
PGHOST=localhost PGPORT=5432 PGUSER=postgres ./scripts/test-pg.sh
```

Ses dosyaları: `SUPABASE_SERVICE_ROLE_KEY` varsa Supabase Storage'ın özel `audio` kovası (`AUDIO_BUCKET` ile
değiştirilebilir), imzalı URL 180 gün. Ebeveyn klon sesiyle üretilenler `clone/<user_id>/` altında; klon ya da hesap
silinince bu klasör silinir. Klon ses: `ELEVENLABS_API_KEY` ile ElevenLabs anlık klon (örnek saklanmaz).

## Anonim analitik

`POST /events` `{ events: [{ name, dims }] }` — yalnızca `_shared/analytics.ts`'deki izinli olay/boyutlar;
`analytics_daily` tablosunda gün + olay + boyut başına sayaç. Kullanıcı kimliği, IP, zaman damgası saklanmaz.

## Davet ve paylaşım (Adım 12)

- **`GET /referral`** kendi davet kodu; **`POST /referral/redeem`** `{ code }` → davet eden + edilen 7 gün Premium
  (`_shared/referral.ts`: hesap başına bir kez, kendi kodu/karşılıklı davet yok, davet eden yılda en çok 12 ödül).
  Ödül `bonus_until` olarak App Store aboneliğinden ayrı tutulur; `/entitlements/verify` `product_id:
  "masalcik.referral.week"` döner.
- **`GET /share/:token`** artık paylaşanın `invite_code`'unu da döner ve masalın yalnızca ilk 3 paragrafını verir
  (web önizlemesi: `web/s/index.html`).

### Gerçek API ile deneme

```bash
ANTHROPIC_API_KEY=... node --experimental-strip-types --no-warnings scripts/smoke-story.ts tr 5
ANTHROPIC_API_KEY=... node --experimental-strip-types --no-warnings scripts/smoke-story.ts en 10
```

### Gizlilik notu

Kişiselleştirme için çocuğun **adı, yaşı ve ilgi alanları** masal üretiminde Anthropic API'sine gider
(veri işleyen). Aydınlatma metninde ve App Store gizlilik etiketinde bu belirtilmeli (Adım 12).
Loglarda ad maskelenir; maliyet ve güvenlik loglarında kullanıcı kimliği tutulmaz.
