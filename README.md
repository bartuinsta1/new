# Masalcık

3–9 yaş Türk çocukları için yapay zekalı, kişiselleştirilmiş sesli uyku masalı uygulaması (iOS 17+).

## Kurulum (macOS)

```bash
brew install xcodegen
xcodegen generate
open Masalcik.xcodeproj      # Masalcik şemasını çalıştır; ⌘U ile testler
```

Gerçek backend'e bağlamak için `Config.xcconfig` içine Supabase adresini ve anon anahtarını yazın
(ya da gitignore'daki `Config.local.xcconfig` dosyasına). Boş bırakılırsa uygulama sahte backend'le çalışır.

Backend:

```bash
cd backend && npm test        # Node 22+, ek bağımlılık yok
supabase functions serve      # Deno ile yerel çalıştırma
```

Tasarım önizlemesi (Xcode olmadan ekran görüntüsü): `node docs/design-preview/screenshot.mjs`

## Diller (Türkçe + İngilizce)

Uygulama baştan iki dilli: arayüz, sesli yönergeler, karakter replikleri ve masal içeriği.

- Kaynak dil Türkçe. Tüm arayüz metinleri `Masalcik/Resources/Localizable.xcstrings` içinde, İngilizce çeviriler
  `scripts/translations/en.json` dosyasında.
- Yeni metin ekledikten sonra: `python3 scripts/extract_strings.py --check` (eksik çeviri varsa hata verir;
  aynı kontrol `backend` testlerinde de çalışır).
- Dil, iOS'un uygulama başına dil ayarından gelir (Ayarlar › Masalcık › Dil). Xcode'da **Masalcik (English)**
  şeması uygulamayı ve testleri İngilizce çalıştırır.
- Masal dili `StoryRequest.language` ile backend'e gider; kütüphane başlıkları `Accept-Language` ile gelir.
- Türkçe çekim ekleri (`Ayşe'ye`, `Fısıltı Ormanı'nda`) `TurkishText`, İngilizce karşılıkları `Region.locativeTitle(in:)`
  ve `EnglishText` ile üretilir.

## Yapı

| Klasör | İçerik |
|---|---|
| `Masalcik/App` | Giriş noktası, `AppConfig` (uygulama adı tek sabit), `AppState` |
| `Masalcik/Core` | SwiftData modelleri, ağ (`StoryAPI`, sahte/gerçek), Türkçe metin kuralları, analitik |
| `Masalcik/DesignSystem` | Tokenlar (renk, tipografi, boyut, hareket), tema, bileşenler, galeri |
| `Masalcik/World`, `Onboarding`, `Tonight`, `Player`, `Library`, `Treasure`, `ParentZone`, `Paywall`, `StoryEngineClient` | Özellik modülleri (Adım 3+) |
| `MasalcikTests` | Swift Testing birim testleri |
| `backend/supabase` | Edge Functions + Postgres şeması (RLS) |
| `docs/design-preview` | Bileşenlerin web kopyası ve ekran görüntüleri |

## Durum

- [x] Adım 1 — İskelet, modüller, SwiftData modelleri, backend uç noktaları (sahte)
- [x] Adım 2 — DesignSystem: tokenlar, gündüz/gece teması, 10 bileşen + Preview'lar
- [x] Adım 3 — Masal Adası haritası: kaydırma/yakınlaştırma, kamera uçuşu, bölgeler, uyuyan bulutlar,
      balon masal kartları, Uyku Evi + avatar, uyku saati parıltısı (+ uygulama genelinde TR/EN)
- [x] Adım 4 — Onboarding (6 adım), avatar + yoldaş, ebeveyn kapısı akışa bağlı, kutlama → doğrudan ilk masal
- [x] Adım 5 — StoryEngine (Claude Haiku 5.5): sistem promptu TR/EN, JSON şeması, güvenlik katmanı
      (girdi temizleme + kural denetimi + moderasyon + yedek), önbellek, idempotency, maliyet panosu — bkz. `backend/README.md`
- [x] Adım 6 — Seslendirme (Azure Neural TR/EN, 4 ses tonu, duyguya göre ton; ebeveyn klon sesi için ElevenLabs)
      + Masal Oynatıcı: paragraf paragraf akış, cihaz sesine düşme, kilit ekranı, uyku zamanlayıcı, ninni,
      kademeli kararma, karaoke altyazı, çevrimdışı indirme
- [x] Adım 7 — "Bu Gece" akışı uçtan uca: Uyku Evi → Kim/Nerede/Ne (ya da "Pamuk seçsin") → kitap animasyonu
      → ilk paragraf gelince oynatıcı; hata/ağ yoksa yerel güvenli masal, hak dolunca kitaplık önerisi;
      cihaza bağlı anonim hesap (Supabase) ve sunucuda JWT kimliği
- [ ] Adım 8 — Kitaplık, Hazine Sandığı, kalıcı karakter hafızası
