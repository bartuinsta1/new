# Masalcık

3–9 yaş Türk çocukları için yapay zekalı, kişiselleştirilmiş sesli uyku masalı uygulaması (iOS 17+).

## Kurulum (macOS)

```bash
brew install xcodegen
xcodegen generate
open Masalcik.xcodeproj      # Masalcik şemasını çalıştır; ⌘U ile testler
```

Backend (sahte yanıtlar, Adım 1):

```bash
cd backend && npm test        # Node 22+, ek bağımlılık yok
supabase functions serve      # Deno ile yerel çalıştırma
```

Tasarım önizlemesi (Xcode olmadan ekran görüntüsü): `node docs/design-preview/screenshot.mjs`

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
- [ ] Adım 3 — Masal Adası haritası
