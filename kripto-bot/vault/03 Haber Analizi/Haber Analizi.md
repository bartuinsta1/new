---
tags: [haber, moc]
---
# Haber Analizi (haber bloğu, %25)

Kod: `bot/news.py`

## Kaynaklar
- RSS: CoinDesk, Cointelegraph, Decrypt, Bitcoin Magazine (`config.yaml → news.rss_feeds`, istediğini ekle; Türkçe kaynak da olur)
- [CryptoPanic](https://cryptopanic.com/developers/api/): coin bazlı haber + topluluk oyları (`CRYPTOPANIC_TOKEN`)
- Korku & Açgözlülük endeksi (alternative.me) → [[Piyasa Bağlamı]]

## Nasıl puanlanır
1. Son 48 saatin haberleri toplanır, coinin sembolü (`SOL`, `$SOL`) ya da adı (`solana`) geçenler seçilir. 2 harfli tickerlar (OP, AI) sadece `$OP` biçiminde eşleşir.
2. Her habere −1..+1 duygu puanı verilir:
   - **Varsayılan:** TR + EN anahtar kelime sözlüğü (surge, partnership, listing, onaylandı / crash, probe, outage, soruşturma...)
   - **Claude açıkken** (`news.llm.enabled: true` + `ANTHROPIC_API_KEY`): haberler bağlamıyla okunur. "X borsası hacklendi" haberinin SOL'u ilgilendirip ilgilendirmediğini ayırt eder. Hata olursa sözlüğe döner.
3. Haberler yaşına göre ağırlanır (12 saatte etkisi yarıya iner).
4. Haber bloğu puanı = 20 × ortalama duygu (+ 5 puan "gündemde ve olumlu" bonusu).
5. Son 24 saatte başlıkta coin + [[Kırmızı Bayraklar|kırmızı bayrak]] varsa → **veto**.

## Sınırlar
- Sözlük yöntemi alaycılığı, "hack iddiaları yalanlandı" gibi cümleleri yanlış okuyabilir. Önemli kararlar için Claude modunu aç.
- Haber çoğu zaman fiyattan sonra gelir. Haber bloğu daha çok **frende** işe yarar (kötü haberde girme), gaz pedalı olarak değil.
