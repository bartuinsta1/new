# Lansman öncesi kontrol listesi

Kod 12 adımda tamamlandı; aşağıdakiler **yayından önce** yapılmalı. (✗ = yapılmadı, bu ortamda yapılamadı.)

## Derleme ve test (Mac gerekli)
- ✗ `xcodegen generate` → derleme hatalarını toplu düzelt (Swift kodu hiç derlenmedi)
- ✗ `⌘U`: birim + UI testleri; snapshot referanslarını kaydet (iPhone 15 / iOS 17.5) ve gözle kontrol et
- ✗ Gerçek cihazda Release: açılış < 2 sn, ilk ses < 15 sn, harita 60 fps (Instruments)
- ✗ App Store ekran görüntülerini gerçek uygulama görüntüleriyle yeniden üret (yerleşim: `preview.html?screen=appstore`)

## Hesaplar ve anahtarlar
- ✗ Supabase projesi, migrasyonlar, `supabase secrets` (ANTHROPIC_API_KEY, AZURE_TTS_*, ELEVENLABS_API_KEY,
  ADMIN_TOKEN, APPLE_BUNDLE_ID, PUBLIC_BASE_URL, APP_STORE_URL)
- ✓ Postgres depoları (`_shared/pg/stores.ts`; Supabase'de `SUPABASE_DB_URL` ile kendiliğinden açılır) —
  gerçek Postgres 16'da test edildi: `backend/scripts/test-pg.sh`
- ✗ Supabase Storage'da **özel** `audio` kovasını oluştur (ses dosyaları imzalı URL ile)
- ✗ Hız sınırlayıcı hâlâ bellek içi (isolate başına); trafik artınca Postgres/Redis'e taşınmalı
- ✗ Apple Root CA G3 parmak izini apple.com'dan teyit et (`APPLE_ROOT_CA_G3_SHA256`)
- ✗ App Store Connect: ürünler (`masalcik.premium.monthly/yearly`, 7 gün deneme), Server Notifications V2 URL,
  Kids kategorisi, gizlilik etiketi (`docs/appstore/gizlilik-etiketi.md`)
- ✗ Associated Domains (`applinks:masalcik.app`) + AASA'da TEAMID; `AppConfig.appStoreURL` gerçek kimlik

## İçerik ve ses
- ✗ Gerçek ninni / beyaz gürültü / ortam sesleri, karakter seslendirmeleri (vp_* kayıtları), kitaplık masallarının
  insan editörden geçmiş metinleri (şu an sahte)
- ✓ ElevenLabs anlık ses klonu oluşturma/silme ve klon sesle üretilmiş dosyaların silinmesi (gerçek anahtarla
  bir kez elle denenmeli)
- ✓ Anonim analitik gönderimi (`POST /events`, cihazda biriktirip toplu gönderim)
- ✗ Gerçek illüstrasyonlar (şu an kod ile çizilmiş yer tutucu karakterler ve ada)

## Hukuk
- ✗ KVKK aydınlatma metni, açık rıza metni, İngilizce gizlilik politikası: avukat incelemesi; şirket bilgileri
- ✗ Yurt dışı aktarım: Anthropic, Azure, ElevenLabs, Supabase için standart sözleşme / DPA + Kurum bildirimi
- ✗ ABD'ye açılmadan önce COPPA doğrulanabilir ebeveyn onayı (VPC)
- ✗ Abonelik koşulları metninin App Store Connect'teki açıklamayla aynı olduğunu doğrula

## Büyüme
- `docs/buyume/`: 30 günlük içerik planı, anaokulu teklifi (sınıf hesabı henüz yok), influencer DM şablonu, davet programı
- `web/`: paylaşım önizleme sayfası (statik barındırmaya yükle, API adresini ayarla)
