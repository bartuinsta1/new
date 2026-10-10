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

### Gerçek API ile deneme

```bash
ANTHROPIC_API_KEY=... node --experimental-strip-types --no-warnings scripts/smoke-story.ts tr 5
ANTHROPIC_API_KEY=... node --experimental-strip-types --no-warnings scripts/smoke-story.ts en 10
```

### Gizlilik notu

Kişiselleştirme için çocuğun **adı, yaşı ve ilgi alanları** masal üretiminde Anthropic API'sine gider
(veri işleyen). Aydınlatma metninde ve App Store gizlilik etiketinde bu belirtilmeli (Adım 12).
Loglarda ad maskelenir; maliyet ve güvenlik loglarında kullanıcı kimliği tutulmaz.
