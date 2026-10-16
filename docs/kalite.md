# Kalite: erişilebilirlik, performans, testler (Adım 11)

## Testleri çalıştırma (macOS)

```bash
xcodegen generate && open Masalcik.xcodeproj
# ⌘U  → birim + snapshot + UI testleri ("Masalcik" şeması, Türkçe)
# "Masalcik (English)" şeması aynı testleri İngilizce çalıştırır
cd backend && npm run check   # sunucu testleri + çeviri denetimi
```

- **Snapshot testleri** (`MasalcikTests/SnapshotTests.swift`, swift-snapshot-testing): ilk çalıştırma referansları
  `MasalcikTests/__Snapshots__/` altına kaydeder ve bir kez başarısız olur; görselleri gözle kontrol edip commit'leyin.
  Referanslar tek simülatörde üretilmeli: **iPhone 15, iOS 17.5**.
- **UI testleri** (`MasalcikUITests`): `-uiTesting` bayrağıyla bellek içi veri, sahte backend ve sahte satın alma;
  ebeveyn kapısı sorusu `-parentGateAnswer 63` ile sabit. Bayraklar yalnızca DEBUG derlemede okunur.
  - Ebeveyn kapısı: yanlış yanıt açmaz, doğru yanıt açar, silme, kapatma, onboarding'de kapı var / Paywall yok.
  - Paywall: X ilk saniyede görünür ve dokunulabilir, iki plan + deneme bitişi + iptal cümlesi + geri yükleme,
    plan değiştirme, sahte satın alma → Premium, İngilizce arayüz.
  - Otomatik erişilebilirlik denetimi (`performAccessibilityAudit`): harita, kapı, Paywall, onboarding.

## Erişilebilirlik kontrol listesi

| Konu | Durum |
|---|---|
| Kontrast (WCAG AA) | `AccessibilityTests` ile sabit. Adım 11'de düzeltilenler: gece butonlarında açık yazı soluk dolguda 1,5–2,5 → koyu yazı 6–10; ikincil metin 4,4 → 5,4; mor metin/bağlantı 3,8 → 5,9; karaoke okunmamış kelimeler 3,7 → 5,5 |
| Dokunma alanı | Çocuk tarafı 64 pt (birincil 96 pt), ebeveyn tarafı ≥ 44 pt |
| VoiceOver | Tüm simge düğmelerinde etiket; dekoratif çizimler gizli; harita VoiceOver açıkken tüm adayı gösterir; Paywall'da X ilk öğe |
| Dynamic Type | Ebeveyn ekranları (Form, Paywall) tamamen ölçeklenir; çocuk tarafındaki iri düğme yazıları bilerek sabit (düzen ve dokunma alanı) |
| Hareketi Azalt | Geçişler sönümlü, gökyüzü/ateşböceği/sallanma durur, kamera animasyonsuz |
| Okuma bilmeyen çocuk | Her yönerge sesli (VoicePromptPlayer), metin balonu isteğe bağlı |

## Performans hedefleri ve ölçüm

| Hedef | Nasıl ölçülür |
|---|---|
| Soğuk açılış < 1,5 sn | `PerformanceUITests.testSogukAcilis` (XCTApplicationLaunchMetric), gerçek cihaz, Release |
| Harita 60 fps | `testHaritaKaydirma` + Instruments › Animation Hitches. Zemin tek `Canvas(opaque:)` ve `.equatable()`: kaydırmada yeniden çizilmez |
| İstek → ilk paragraf < 20 sn | Instruments › Points of Interest › `StoryFirstParagraph` aralığı (`Perf`) |
| Pil (yatma saati) | Gökyüzü 24 fps; ekran %80 karardığında animasyon durur; ekran kararması + uyku zamanlayıcısı |
| Ağ | Masal NDJSON akışı (ilk paragraf gelince çalmaya başlar); TTS sunucuda önbellekli; kitaplık listesi CDN'de 1 saat |
